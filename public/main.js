// Entry point: wires the UI to the app state.
// Event handlers change the state through the transitions in state.js, then
// call render() (layout + draw) or, while a drag moves, just draw().
import {
    GRID_MIN, GRID_MAX, largestSize, previewCellSize, cellRect, dropTargetIndex, imageIndexAt
} from './layout.js';
import * as model from './state.js';
import { isImageFile, loadImages } from './images.js';
import { drawGrid, drawMarkers } from './render.js';
import { renderGridToBlob, saveBlob } from './export.js';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const fileInput = document.getElementById('fileInput');
const downloadBtn = document.getElementById('downloadBtn');
const emptyMessage = document.getElementById('message-container');
const notice = document.getElementById('notice');
const noticeText = document.getElementById('noticeText');
const noticeClose = document.getElementById('noticeClose');
const announcer = document.getElementById('announcer');
const steppers = {
    rowsValue: document.getElementById('rowsValue'),
    colsValue: document.getElementById('colsValue'),
    rowsDec: document.getElementById('rowsDec'),
    rowsInc: document.getElementById('rowsInc'),
    colsDec: document.getElementById('colsDec'),
    colsInc: document.getElementById('colsInc')
};

// Share of the viewport the preview canvas may use.
const VIEWPORT_WIDTH_SHARE = 0.9;
const VIEWPORT_HEIGHT_SHARE = 0.8;
// Smallest cell edge in CSS pixels, so each cell is a usable touch target
// (WCAG 2.5.5); matches --target-size in index.html.
const MIN_CELL_SIZE = 44;
// A press that moves less than this (CSS px) before release is a tap, which
// picks up or swaps images instead of dragging.
const TAP_DISTANCE = 6;

const state = model.createState();

// Preview layout from the last render, in CSS pixels. Used for hit-testing.
let grid = { rows: state.rows, cols: state.cols, cellWidth: 0, cellHeight: 0 };

// ---------------------------------------------------------------- rendering

// Largest CSS size the canvas content may take. Besides the viewport share it
// must fit the page's content box minus the canvas border, or narrow phones
// would scroll sideways.
function availableCanvasSize() {
    const body = getComputedStyle(document.body);
    const contentWidth = document.documentElement.clientWidth
        - parseFloat(body.paddingLeft) - parseFloat(body.paddingRight);
    const border = canvas.offsetWidth - canvas.clientWidth;
    return {
        width: Math.max(1, Math.min(window.innerWidth * VIEWPORT_WIDTH_SHARE, contentWidth - border)),
        height: window.innerHeight * VIEWPORT_HEIGHT_SHARE
    };
}

function computePreviewGrid() {
    const visible = model.visibleImages(state);
    const available = availableCanvasSize();
    const cell = previewCellSize({
        content: visible.length > 0 ? largestSize(visible) : null,
        rows: state.rows,
        cols: state.cols,
        maxWidth: available.width,
        maxHeight: available.height,
        minCell: MIN_CELL_SIZE
    });
    return { rows: state.rows, cols: state.cols, cellWidth: cell.width, cellHeight: cell.height };
}

// Full update: recompute the layout, resize the canvas, redraw and sync the UI.
function render() {
    grid = computePreviewGrid();

    // Size the backing store for the device pixel ratio so it stays sharp on
    // high-density screens, and draw in CSS pixels via the transform.
    const cssWidth = grid.cols * grid.cellWidth;
    const cssHeight = grid.rows * grid.cellHeight;
    const dpr = window.devicePixelRatio || 1;
    const pixelWidth = Math.round(cssWidth * dpr);
    const pixelHeight = Math.round(cssHeight * dpr);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
    }
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    draw();
    emptyMessage.hidden = state.images.length > 0;
    renderSteppers();
}

// Redraw only, for changes that don't affect the layout (a drag moving).
function draw() {
    drawGrid(ctx, grid, model.visibleImages(state), state.drag);
    drawMarkers(ctx, grid, {
        selected: state.selected,
        cursor: state.cursor,
        showCursor: document.activeElement === canvas && canvas.matches(':focus-visible'),
        colors: markerColors()
    });
    canvas.classList.toggle('dragging', state.drag !== null);
}

// Marker colours come from the page's colour tokens, so they follow the theme.
function markerColors() {
    const css = getComputedStyle(document.documentElement);
    return {
        cursor: css.getPropertyValue('--focus').trim(),
        selected: css.getPropertyValue('--accent').trim(),
        backing: css.getPropertyValue('--surface').trim()
    };
}

function renderSteppers() {
    steppers.rowsValue.textContent = state.rows;
    steppers.colsValue.textContent = state.cols;
    // aria-disabled instead of disabled, so focus stays on a button that just
    // reached its limit; pressing it again is a no-op because sizes are clamped.
    steppers.rowsDec.setAttribute('aria-disabled', state.rows <= GRID_MIN);
    steppers.rowsInc.setAttribute('aria-disabled', state.rows >= GRID_MAX);
    steppers.colsDec.setAttribute('aria-disabled', state.cols <= GRID_MIN);
    steppers.colsInc.setAttribute('aria-disabled', state.cols >= GRID_MAX);
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// Reads `message` out to screen readers without showing anything.
function announce(message) {
    // Clearing first makes a repeated identical message be announced again.
    announcer.textContent = '';
    requestAnimationFrame(() => { announcer.textContent = message; });
}

// Shows a message until the user dismisses it or a new one replaces it
// (no timeout, so there is always enough time to read it) and announces it.
function showNotice(message) {
    noticeText.textContent = message;
    notice.hidden = false;
    announce(message);
}

// Hiding the notice removes the focused Dismiss button, so focus moves on to
// the grid, the next control in reading order, instead of the page body.
noticeClose.addEventListener('click', () => {
    notice.hidden = true;
    canvas.focus();
});

const capacityMessage = () => `Please upload a total of up to ${model.capacity(state)} images.`;

// ------------------------------------------------------------------ actions

function changeGridSize(rows, cols) {
    model.setGridSize(state, rows, cols);
    render();
    announce(`Grid: ${plural(state.rows, 'row')} by ${plural(state.cols, 'column')}.`);
}

// Loads run in parallel but are applied in the order they were started, so the
// newest file selection wins, and a drop made while a selection is still
// loading lands on top of that selection instead of being overwritten by it.
let applyQueue = Promise.resolve();

function addFiles(files, options) {
    const loading = loadImages(files);
    applyQueue = applyQueue
        .then(() => loading)
        .then((result) => applyLoadedImages(result, options))
        .catch((error) => console.error(error)); // keep the queue usable after a failure
}

// `note` is an optional message from when the files were picked, shown
// together with any messages about the load itself.
function applyLoadedImages({ loaded, failed }, { replace, note }) {
    const messages = note ? [note] : [];
    if (failed > 0) {
        messages.push(`${failed} file(s) could not be loaded as images and were skipped.`);
    }
    if (loaded.length > 0) {
        let added = true;
        if (replace) {
            model.replaceImages(state, loaded);
        } else {
            // appendImages re-checks the capacity: another drop may have
            // filled the grid while these files were loading.
            added = model.appendImages(state, loaded);
        }
        if (added) {
            render();
            // Stands in for the native file input's "N files" text, which is hidden.
            if (messages.length === 0) announce(`${plural(loaded.length, 'image')} added.`);
        } else {
            messages.push(capacityMessage());
        }
    }
    if (messages.length > 0) showNotice(messages.join(' '));
}

async function downloadCombinedImage() {
    // aria-disabled instead of disabled while exporting, so keyboard focus
    // stays on the button.
    if (downloadBtn.getAttribute('aria-disabled') === 'true') return;
    const visible = model.visibleImages(state);
    if (visible.length === 0) {
        showNotice('Add some images first.');
        return;
    }
    downloadBtn.setAttribute('aria-disabled', 'true');
    announce('Preparing the combined image…');
    try {
        const result = await renderGridToBlob(visible, state.rows, state.cols);
        if (!result) {
            showNotice('The combined image is too large for this browser. Try fewer or smaller images.');
            return;
        }
        saveBlob(result.blob, 'combined-image.png');
        if (result.scaled) {
            showNotice('The combined image was scaled down to stay within the browser’s size limit.');
        }
    } finally {
        downloadBtn.removeAttribute('aria-disabled');
    }
}

// ------------------------------------------------------- file input & drop

// The image files in `fileList`, or null (after telling the user) if there are none.
function pickImageFiles(fileList) {
    const all = Array.from(fileList);
    const files = all.filter(isImageFile);
    if (files.length > 0) return files;
    if (all.length > 0) showNotice('Only image files can be added.');
    return null;
}

fileInput.addEventListener('change', () => {
    const files = pickImageFiles(fileInput.files);
    // Reset so that selecting the same files again still fires 'change'.
    fileInput.value = '';
    if (!files) return;
    const capacity = model.capacity(state);
    const leftOut = files.length - capacity;
    addFiles(files.slice(0, capacity), {
        replace: true,
        note: leftOut > 0 ? `The grid holds ${capacity} images, so ${leftOut} file(s) were left out.` : null
    });
});

canvas.addEventListener('dragover', (e) => {
    e.preventDefault();
    canvas.classList.add('drag-over');
});

canvas.addEventListener('dragleave', () => {
    canvas.classList.remove('drag-over');
});

canvas.addEventListener('drop', (e) => {
    e.preventDefault();
    canvas.classList.remove('drag-over');
    const files = pickImageFiles(e.dataTransfer.files);
    if (!files) return;
    // Checked up front too, so an oversized drop is refused before loading anything.
    if (model.exceedsCapacity(state, files.length)) {
        showNotice(capacityMessage());
        return;
    }
    addFiles(files, { replace: false });
});

// Files dropped anywhere else on the page would otherwise make the browser open
// them, replacing the app (and the arrangement) with the image. The canvas
// handles its own drops.
window.addEventListener('dragover', (e) => {
    if (e.target === canvas) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'none';
});
window.addEventListener('drop', (e) => {
    if (e.target !== canvas) e.preventDefault();
});

// ------------------------------------------------------- reorder by dragging

function pointerPosition(e) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: e.clientX - rect.left - canvas.clientLeft,
        y: e.clientY - rect.top - canvas.clientTop
    };
}

canvas.addEventListener('pointerdown', (e) => {
    // Another pointer is already dragging. (The same pointer pressing again means
    // its earlier release was missed, so that drag is simply replaced.)
    if (e.button !== 0 || (state.drag && state.drag.pointerId !== e.pointerId)) return;
    const p = pointerPosition(e);
    const index = imageIndexAt(p.x, p.y, model.visibleImages(state), grid);
    if (index < 0) return;

    e.preventDefault();
    try {
        // Keep receiving events when the pointer leaves the canvas mid-drag.
        canvas.setPointerCapture(e.pointerId);
    } catch {
        // Capture is a nicety; the window listeners below still end the drag.
    }
    const cell = cellRect(index, grid);
    model.startDrag(state, {
        index, pointerId: e.pointerId, x: p.x, y: p.y, startX: p.x, startY: p.y,
        offsetX: p.x - cell.x, offsetY: p.y - cell.y
    });
    draw();
});

const isDragPointer = (e) => state.drag !== null && e.pointerId === state.drag.pointerId;

// Move/end listeners sit on window: with pointer capture the events bubble up
// from the canvas, and if capture failed a release outside the canvas still ends the drag.
window.addEventListener('pointermove', (e) => {
    if (!isDragPointer(e)) return;
    const p = pointerPosition(e);
    model.moveDrag(state, p.x, p.y);
    draw();
});

window.addEventListener('pointerup', (e) => {
    if (!isDragPointer(e)) return;
    const drag = state.drag;
    if (Math.hypot(drag.x - drag.startX, drag.y - drag.startY) < TAP_DISTANCE) {
        // A tap: the single-pointer alternative to dragging.
        model.cancelDrag(state);
        activateCell(drag.index);
        return;
    }
    const target = dropTargetIndex(drag, grid, model.visibleImages(state).length);
    model.finishDrag(state, target);
    draw();
});

window.addEventListener('pointercancel', (e) => {
    if (!isDragPointer(e)) return;
    model.cancelDrag(state);
    draw();
});

// Stop the page from scrolling when a touch starts on an image, but still
// allow scrolling when it starts on empty space.
canvas.addEventListener('touchstart', (e) => {
    const p = pointerPosition(e.changedTouches[0]);
    if (imageIndexAt(p.x, p.y, model.visibleImages(state), grid) >= 0) {
        e.preventDefault();
    }
}, { passive: false });

// ------------------------------------------- keyboard and tap reordering

const imageName = (index) => model.visibleImages(state)[index]?.alt || `image ${index + 1}`;

function describeCell(index) {
    const row = Math.floor(index / state.cols) + 1;
    const col = (index % state.cols) + 1;
    const content = index < model.visibleImages(state).length ? imageName(index) : 'empty';
    const picked = state.selected === index ? ', picked up' : '';
    return `Row ${row}, column ${col}: ${content}${picked}.`;
}

// Picks up / swaps / puts back the image at `index` and says what happened.
function activateCell(index) {
    const picked = state.selected;
    switch (model.activateCell(state, index)) {
        case 'picked':
            announce(`Picked up ${imageName(index)}. Move to another image and press Space to swap, or Escape to cancel.`);
            break;
        case 'swapped':
            announce(`Swapped ${imageName(index)} and ${imageName(picked)}.`);
            break;
        case 'put-back':
            announce(`Put back ${imageName(index)}.`);
            break;
        case 'none':
            announce(picked !== null
                ? 'This cell is empty. Choose another image to swap with.'
                : 'This cell is empty.');
            break;
    }
    draw();
}

// Scrolls the canvas' box so the cursor cell is visible when the grid is
// wider than the screen.
function keepCursorVisible() {
    const box = canvas.parentElement;
    const cell = cellRect(state.cursor, grid);
    if (cell.x < box.scrollLeft) box.scrollLeft = cell.x;
    else if (cell.x + cell.width > box.scrollLeft + box.clientWidth) {
        box.scrollLeft = cell.x + cell.width - box.clientWidth;
    }
}

const ARROW_MOVES = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };

canvas.addEventListener('keydown', (e) => {
    if (ARROW_MOVES[e.key]) {
        model.moveCursor(state, ...ARROW_MOVES[e.key]);
        keepCursorVisible();
        announce(describeCell(state.cursor));
        draw();
    } else if (e.key === ' ' || e.key === 'Enter') {
        activateCell(state.cursor);
    } else if (e.key === 'Escape' && state.selected !== null) {
        model.clearSelection(state);
        announce('Swap cancelled.');
        draw();
    } else {
        return;
    }
    e.preventDefault();
});

canvas.addEventListener('focus', () => {
    keepCursorVisible();
    draw();
});
canvas.addEventListener('blur', draw);

// ------------------------------------------------------------ other controls

downloadBtn.addEventListener('click', downloadCombinedImage);
steppers.rowsDec.addEventListener('click', () => changeGridSize(state.rows - 1, state.cols));
steppers.rowsInc.addEventListener('click', () => changeGridSize(state.rows + 1, state.cols));
steppers.colsDec.addEventListener('click', () => changeGridSize(state.rows, state.cols - 1));
steppers.colsInc.addEventListener('click', () => changeGridSize(state.rows, state.cols + 1));

// A resize keeps a running drag: its image index stays valid, and the drop
// target is worked out against the new layout.
window.addEventListener('resize', render);

// Re-render when the device pixel ratio changes without a resize, e.g. when
// the window moves to a monitor with a different pixel density.
function watchPixelRatio() {
    matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`).addEventListener('change', () => {
        render();
        watchPixelRatio();
    }, { once: true });
}
watchPixelRatio();

render();
