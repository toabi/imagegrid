// App state and the rules for changing it. No DOM in here, so every rule can
// be unit-tested with `node --test`.
//
// Invariant: a running drag and a picked-up image refer to images by their
// index in `images`, so every transition that changes the images or the grid
// size ends both.
import { clamp, clampGridSize } from './layout.js';

export function createState({ rows = 2, cols = 4 } = {}) {
    return {
        rows: clampGridSize(rows),
        cols: clampGridSize(cols),
        // All loaded images, in grid order. Only the first rows × cols are
        // shown; the rest are kept so that growing the grid brings them back.
        images: [],
        // Active reorder drag:
        // { index, pointerId, x, y, startX, startY, offsetX, offsetY } or null.
        drag: null,
        // Index of the image picked up for a swap (keyboard or tap), or null.
        selected: null,
        // Cell index of the keyboard cursor.
        cursor: 0
    };
}

// Ends drag and selection and keeps the cursor inside the grid; called by
// every transition that changes the images or the grid size.
function resetInteraction(state) {
    state.drag = null;
    state.selected = null;
    state.cursor = clamp(state.cursor, 0, capacity(state) - 1);
}

function swap(state, a, b) {
    const images = state.images;
    [images[a], images[b]] = [images[b], images[a]];
}

export function capacity(state) {
    return state.rows * state.cols;
}

export function visibleImages(state) {
    return state.images.slice(0, capacity(state));
}

// Whether adding `count` more images would go over the grid's capacity.
export function exceedsCapacity(state, count) {
    return state.images.length + count > capacity(state);
}

export function setGridSize(state, rows, cols) {
    state.rows = clampGridSize(rows);
    state.cols = clampGridSize(cols);
    resetInteraction(state);
}

export function replaceImages(state, images) {
    state.images = [...images];
    resetInteraction(state);
}

// Appends the images if they fit. Returns false (and changes nothing) if not.
export function appendImages(state, images) {
    if (exceedsCapacity(state, images.length)) return false;
    state.images = [...state.images, ...images];
    resetInteraction(state);
    return true;
}

export function startDrag(state, drag) {
    state.drag = { ...drag };
}

export function moveDrag(state, x, y) {
    if (!state.drag) return;
    state.drag.x = x;
    state.drag.y = y;
}

export function cancelDrag(state) {
    state.drag = null;
}

// Ends the drag, swapping the dragged image with the one at `targetIndex`
// if that is another visible image.
export function finishDrag(state, targetIndex) {
    const drag = state.drag;
    state.drag = null;
    if (!drag || targetIndex === drag.index) return;
    if (targetIndex < 0 || targetIndex >= visibleImages(state).length) return;
    swap(state, drag.index, targetIndex);
    // The swap moved images, so a picked-up index may no longer be right.
    state.selected = null;
}

// Moves the keyboard cursor by whole cells, stopping at the grid's edges.
export function moveCursor(state, dRow, dCol) {
    const row = clamp(Math.floor(state.cursor / state.cols) + dRow, 0, state.rows - 1);
    const col = clamp((state.cursor % state.cols) + dCol, 0, state.cols - 1);
    state.cursor = row * state.cols + col;
}

// The dragging alternative: activating a cell (Space/Enter on the cursor, or
// a tap) picks up its image, then activating another image swaps the two.
// Returns what happened: 'picked', 'swapped', 'put-back' (the picked image
// again) or 'none' (an empty cell).
export function activateCell(state, index) {
    state.cursor = index;
    if (index >= visibleImages(state).length) return 'none';
    if (state.selected === null) {
        state.selected = index;
        return 'picked';
    }
    const picked = state.selected;
    state.selected = null;
    if (picked === index) return 'put-back';
    swap(state, picked, index);
    return 'swapped';
}

export function clearSelection(state) {
    state.selected = null;
}
