// Entry point: owns the app state and wires the UI to it.
// Every change updates `state` and then calls render().
import {
    GRID_MIN, GRID_MAX, clampGridSize, largestSize, previewCellSize,
    cellRect, cellIndexAt, imageIndexAt
} from './layout.js';
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

const state = {
    rows: 2,
    cols: 4,
    // All loaded images, in grid order. Only the first rows × cols are shown;
    // the rest are kept so that growing the grid again brings them back.
    images: [],
    // Active reorder drag: { index, pointerId, x, y, offsetX, offsetY } or null.
    drag: null
};

// Preview layout from the last render, in CSS pixels. Used for hit-testing.
let grid = { rows: state.rows, cols: state.cols, cellWidth: 0, cellHeight: 0 };

const maxImages = () => state.rows * state.cols;
const visibleImages = () => state.images.slice(0, maxImages());

// ---------------------------------------------------------------- rendering

function computePreviewGrid() {
    const visible = visibleImages();
    const cell = previewCellSize({
        content: visible.length > 0 ? largestSize(visible) : null,
        rows: state.rows,
        cols: state.cols,
        maxWidth: window.innerWidth * 0.9,
        maxHeight: window.innerHeight * 0.8
    });
    return { rows: state.rows, cols: state.cols, cellWidth: cell.width, cellHeight: cell.height };
}

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

    drawGrid(ctx, grid, visibleImages(), state.drag);

    emptyMessage.hidden = state.images.length > 0;
    canvas.classList.toggle('dragging', state.drag !== null);
    renderSteppers();
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

// ------------------------------------------------------------------ actions

function setGridSize(rows, cols) {
    state.rows = clampGridSize(rows);
    state.cols = clampGridSize(cols);
    render();
}

async function addFiles(files, { replace }) {
    const { loaded, failed } = await loadImages(files);
    if (failed > 0) {
        showNotice(`${failed} file(s) could not be loaded as images and were skipped.`);
    }
    if (loaded.length === 0) return;
    state.images = replace ? loaded : [...state.images, ...loaded];
    render();
}

function swapImages(a, b) {
    [state.images[a], state.images[b]] = [state.images[b], state.images[a]];
}

async function downloadCombinedImage() {
    const visible = visibleImages();
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

fileInput.addEventListener('change', () => {
    const all = Array.from(fileInput.files);
    // Reset so that selecting the same files again still fires 'change'.
    fileInput.value = '';
    const files = all.filter(isImageFile).slice(0, maxImages());
    if (files.length === 0) {
        if (all.length > 0) showNotice('Only image files can be added.');
        return;
    }
    addFiles(files, { replace: true });
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
    const all = Array.from(e.dataTransfer.files);
    const files = all.filter(isImageFile);
    if (files.length === 0) {
        if (all.length > 0) showNotice('Only image files can be added.');
        return;
    }
    if (state.images.length + files.length > maxImages()) {
        showNotice(`Please upload a total of up to ${maxImages()} images.`);
        return;
    }
    addFiles(files, { replace: false });
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
    if (e.button !== 0 || state.drag) return;
    const p = pointerPosition(e);
    const index = imageIndexAt(p.x, p.y, visibleImages(), grid);
    if (index < 0) return;

    e.preventDefault();
    try {
        // Keep receiving events when the pointer leaves the canvas mid-drag.
        canvas.setPointerCapture(e.pointerId);
    } catch {
        // Capture is a nicety; dragging within the canvas still works without it.
    }
    const cell = cellRect(index, grid);
    state.drag = { index, pointerId: e.pointerId, x: p.x, y: p.y, offsetX: p.x - cell.x, offsetY: p.y - cell.y };
    render();
});

canvas.addEventListener('pointermove', (e) => {
    if (!state.drag || e.pointerId !== state.drag.pointerId) return;
    const p = pointerPosition(e);
    state.drag.x = p.x;
    state.drag.y = p.y;
    render();
});

function endDrag(e, commit) {
    const drag = state.drag;
    if (!drag || e.pointerId !== drag.pointerId) return;
    state.drag = null;
    if (commit) {
        // Drop into the cell under the centre of the dragged image.
        const centreX = drag.x - drag.offsetX + grid.cellWidth / 2;
        const centreY = drag.y - drag.offsetY + grid.cellHeight / 2;
        const target = cellIndexAt(centreX, centreY, grid);
        if (target !== drag.index && target < visibleImages().length) {
            swapImages(drag.index, target);
        }
    }
    render();
}

canvas.addEventListener('pointerup', (e) => endDrag(e, true));
canvas.addEventListener('pointercancel', (e) => endDrag(e, false));

// Stop the page from scrolling when a touch starts on an image, but still
// allow scrolling when it starts on empty space.
canvas.addEventListener('touchstart', (e) => {
    const touch = e.touches[0];
    const p = pointerPosition(touch);
    if (imageIndexAt(p.x, p.y, visibleImages(), grid) >= 0) {
        e.preventDefault();
    }
}, { passive: false });

// ------------------------------------------------------------ other controls

downloadBtn.addEventListener('click', downloadCombinedImage);
steppers.rowsDec.addEventListener('click', () => setGridSize(state.rows - 1, state.cols));
steppers.rowsInc.addEventListener('click', () => setGridSize(state.rows + 1, state.cols));
steppers.colsDec.addEventListener('click', () => setGridSize(state.rows, state.cols - 1));
steppers.colsInc.addEventListener('click', () => setGridSize(state.rows, state.cols + 1));
window.addEventListener('resize', render);

render();
