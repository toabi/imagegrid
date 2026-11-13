import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    clampGridSize, largestSize, cellRect, fitRect, previewCellSize,
    cellIndexAt, dropTargetIndex, imageIndexAt, limitScale
} from '../public/layout.js';

const grid = { rows: 2, cols: 4, cellWidth: 100, cellHeight: 50 };

test('clampGridSize keeps values within 1..8', () => {
    assert.equal(clampGridSize(0), 1);
    assert.equal(clampGridSize(9), 8);
    assert.equal(clampGridSize(3), 3);
    assert.equal(clampGridSize(NaN), 1);
    assert.equal(clampGridSize(undefined), 1);
});

test('largestSize takes max width and height independently', () => {
    assert.deepEqual(largestSize([{ width: 400, height: 100 }, { width: 50, height: 300 }]), { width: 400, height: 300 });
    assert.deepEqual(largestSize([]), { width: 0, height: 0 });
});

test('cellRect fills row by row', () => {
    assert.deepEqual(cellRect(0, grid), { x: 0, y: 0, width: 100, height: 50 });
    assert.deepEqual(cellRect(5, grid), { x: 100, y: 50, width: 100, height: 50 });
});

test('fitRect letterboxes and centres', () => {
    // 1:1 image in a 100×50 box -> 50×50, centred horizontally.
    assert.deepEqual(fitRect(10, 10, { x: 0, y: 0, width: 100, height: 50 }), { x: 25, y: 0, width: 50, height: 50 });
    // Upscales small images to fill the box.
    assert.deepEqual(fitRect(20, 10, { x: 10, y: 10, width: 100, height: 50 }), { x: 10, y: 10, width: 100, height: 50 });
});

test('previewCellSize never upscales and fits the space', () => {
    assert.deepEqual(previewCellSize({ content: { width: 100, height: 50 }, rows: 2, cols: 4, maxWidth: 10000, maxHeight: 10000 }), { width: 100, height: 50 });
    const s = previewCellSize({ content: { width: 1000, height: 500 }, rows: 2, cols: 4, maxWidth: 800, maxHeight: 800 });
    assert.deepEqual(s, { width: 200, height: 100 });
    assert.deepEqual(previewCellSize({ content: null, rows: 2, cols: 4, maxWidth: 240, maxHeight: 1000 }), { width: 60, height: 120 });
});

test('previewCellSize keeps the shorter cell side at least minCell', () => {
    // 2:1 content squeezed to 20×10 per cell grows to 88×44.
    assert.deepEqual(previewCellSize({ content: { width: 200, height: 100 }, rows: 1, cols: 8, maxWidth: 160, maxHeight: 1000, minCell: 44 }), { width: 88, height: 44 });
    // Already large enough: unchanged.
    assert.deepEqual(previewCellSize({ content: { width: 100, height: 50 }, rows: 1, cols: 1, maxWidth: 1000, maxHeight: 1000, minCell: 44 }), { width: 100, height: 50 });
});

test('cellIndexAt clamps points outside the grid to edge cells', () => {
    assert.equal(cellIndexAt(150, 10, grid), 1);
    assert.equal(cellIndexAt(-20, 70, grid), 4);
    assert.equal(cellIndexAt(9999, 9999, grid), 7);
});

test('dropTargetIndex uses the centre of the dragged cell box', () => {
    // Dragging image 0 (grabbed at its cell's centre) to the middle of cell 1.
    const drag = (x, y) => ({ index: 0, x, y, offsetX: 50, offsetY: 25 });
    assert.equal(dropTargetIndex(drag(150, 25), grid, 3), 1);
    assert.equal(dropTargetIndex(drag(95, 25), grid, 3), -1);              // centre still in cell 0
    assert.equal(dropTargetIndex(drag(105, 25), grid, 3), 1);               // just past the edge
    assert.equal(dropTargetIndex(drag(350, 75), grid, 3), -1);              // empty cell 7
    assert.equal(dropTargetIndex(drag(150, -500), grid, 3), 1);             // above the grid clamps to row 0
});

test('imageIndexAt only hits the drawn image area', () => {
    const images = [{ width: 10, height: 10 }, { width: 20, height: 10 }];
    assert.equal(imageIndexAt(50, 25, images, grid), 0);   // centre of square image
    assert.equal(imageIndexAt(5, 25, images, grid), -1);   // letterbox beside it
    assert.equal(imageIndexAt(105, 25, images, grid), 1);  // wide image fills its cell
    assert.equal(imageIndexAt(250, 25, images, grid), -1); // empty cell
    assert.equal(imageIndexAt(-1, 25, images, grid), -1);  // outside the grid
});

test('limitScale respects side and area limits', () => {
    assert.equal(limitScale(1000, 1000, { maxSide: 2000, maxArea: 4e6 }), 1);
    assert.equal(limitScale(4000, 1000, { maxSide: 2000, maxArea: 1e9 }), 0.5);
    assert.equal(limitScale(2000, 2000, { maxSide: 10000, maxArea: 1e6 }), 0.5);
});
