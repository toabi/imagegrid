// Entry point: wires the UI to the app state.
// Event handlers change the state through the transitions in state.js, then
// call render() (layout + draw) or, while a drag moves, just draw().
import {
    GRID_MIN, GRID_MAX, largestSize, previewCellSize, cellRect, dropTargetIndex, imageIndexAt
} from './layout.js';
import * as model from './state.js';
import { isImageFile, loadImages } from './images.js';
import { drawGrid } from './render.js';
import { renderGridToBlob, saveBlob } from './export.js';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const fileInput = document.getElementById('fileInput');
const downloadBtn = document.getElementById('downloadBtn');
const emptyMessage = document.getElementById('message-container');
const notice = document.getElementById('notice');
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

const state = model.createState({ rows: 2, cols: 4 });

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
        maxHeight: available.height
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
    canvas.classList.toggle('dragging', state.drag !== null);
}

function renderSteppers() {
    steppers.rowsValue.textContent = state.rows;
    steppers.colsValue.textContent = state.cols;
    steppers.rowsDec.disabled = state.rows <= GRID_MIN;
    steppers.rowsInc.disabled = state.rows >= GRID_MAX;
    steppers.colsDec.disabled = state.cols <= GRID_MIN;
    steppers.colsInc.disabled = state.cols >= GRID_MAX;
}

let noticeTimer;
function showNotice(message) {
    notice.textContent = message;
    notice.hidden = false;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => { notice.hidden = true; }, 5000);
}

const capacityMessage = () => `Please upload a total of up to ${model.capacity(state)} images.`;

// ------------------------------------------------------------------ actions

function changeGridSize(rows, cols) {
    model.setGridSize(state, rows, cols);
    render();
}

// Bumped by every replacing load, so loads that started before it are dropped
// when they finish instead of overwriting the newer selection.
let replaceGeneration = 0;

async function addFiles(files, { replace }) {
    const generation = replace ? ++replaceGeneration : replaceGeneration;
    const { loaded, failed } = await loadImages(files);
    if (generation !== replaceGeneration) return;

    const messages = [];
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
        if (added) render();
        else messages.push(capacityMessage());
    }
    if (messages.length > 0) showNotice(messages.join(' '));
}

async function downloadCombinedImage() {
    const visible = model.visibleImages(state);
    if (visible.length === 0) {
        showNotice('Add some images first.');
        return;
    }
    downloadBtn.disabled = true;
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
        downloadBtn.disabled = false;
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
    if (files) addFiles(files.slice(0, model.capacity(state)), { replace: true });
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

// Files dropped beside the canvas would otherwise make the browser open them,
// replacing the app (and the arrangement) with the image.
window.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (e.target !== canvas) e.dataTransfer.dropEffect = 'none';
});
window.addEventListener('drop', (e) => e.preventDefault());

// ------------------------------------------------------- reorder by dragging

function pointerPosition(e) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: e.clientX - rect.left - canvas.clientLeft,
        y: e.clientY - rect.top - canvas.clientTop
    };
}

canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || state.drag) return;
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
    model.startDrag(state, { index, pointerId: e.pointerId, x: p.x, y: p.y, offsetX: p.x - cell.x, offsetY: p.y - cell.y });
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
    const target = dropTargetIndex(state.drag, grid, model.visibleImages(state).length);
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
