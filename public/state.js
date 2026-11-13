// App state and the rules for changing it. No DOM in here, so every rule can
// be unit-tested with `node --test`.
//
// Invariant: a running drag refers to an image by its index in `images`, so
// every transition that changes the images or the grid size ends the drag.
import { clampGridSize } from './layout.js';

export function createState({ rows = 2, cols = 4 } = {}) {
    return {
        rows: clampGridSize(rows),
        cols: clampGridSize(cols),
        // All loaded images, in grid order. Only the first rows × cols are
        // shown; the rest are kept so that growing the grid brings them back.
        images: [],
        // Active reorder drag: { index, pointerId, x, y, offsetX, offsetY } or null.
        drag: null
    };
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
    state.drag = null;
}

export function replaceImages(state, images) {
    state.images = [...images];
    state.drag = null;
}

// Appends the images if they fit. Returns false (and changes nothing) if not.
export function appendImages(state, images) {
    if (exceedsCapacity(state, images.length)) return false;
    state.images = [...state.images, ...images];
    state.drag = null;
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
    const images = state.images;
    [images[drag.index], images[targetIndex]] = [images[targetIndex], images[drag.index]];
}
