import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as model from '../public/state.js';

const img = (name) => ({ name, width: 10, height: 10 });
const names = (state) => state.images.map((i) => i.name);
const dragOf = (index) => ({ index, pointerId: 1, x: 0, y: 0, offsetX: 0, offsetY: 0 });

test('createState clamps the grid size', () => {
    const s = model.createState({ rows: 0, cols: 20 });
    assert.equal(s.rows, 1);
    assert.equal(s.cols, 8);
    assert.equal(model.capacity(s), 8);
});

test('visibleImages keeps hidden images for when the grid grows', () => {
    const s = model.createState({ rows: 1, cols: 3 });
    model.replaceImages(s, [img('a'), img('b'), img('c')]);
    model.setGridSize(s, 1, 2);
    assert.deepEqual(model.visibleImages(s).map((i) => i.name), ['a', 'b']);
    model.setGridSize(s, 1, 3);
    assert.deepEqual(model.visibleImages(s).map((i) => i.name), ['a', 'b', 'c']);
});

test('appendImages refuses images that do not fit', () => {
    const s = model.createState({ rows: 1, cols: 2 });
    assert.equal(model.appendImages(s, [img('a')]), true);
    assert.equal(model.exceedsCapacity(s, 2), true);
    assert.equal(model.appendImages(s, [img('b'), img('c')]), false);
    assert.deepEqual(names(s), ['a']);
});

test('changing images or grid size ends a running drag', () => {
    const s = model.createState();
    model.replaceImages(s, [img('a'), img('b')]);
    for (const change of [
        () => model.setGridSize(s, 2, 2),
        () => model.replaceImages(s, [img('x')]),
        () => model.appendImages(s, [img('y')])
    ]) {
        model.startDrag(s, dragOf(0));
        change();
        assert.equal(s.drag, null);
    }
});

test('finishDrag swaps with another visible image only', () => {
    const s = model.createState({ rows: 1, cols: 3 });
    model.replaceImages(s, [img('a'), img('b'), img('c')]);

    model.startDrag(s, dragOf(0));
    model.finishDrag(s, 2);
    assert.deepEqual(names(s), ['c', 'b', 'a']);
    assert.equal(s.drag, null);

    model.startDrag(s, dragOf(0));
    model.finishDrag(s, -1);          // empty cell / own cell
    model.startDrag(s, dragOf(0));
    model.finishDrag(s, 5);           // outside the visible images
    assert.deepEqual(names(s), ['c', 'b', 'a']);

    model.finishDrag(s, 1);           // no drag running: nothing happens
    assert.deepEqual(names(s), ['c', 'b', 'a']);
});

test('moveDrag updates the pointer position only while dragging', () => {
    const s = model.createState();
    model.moveDrag(s, 5, 5);
    assert.equal(s.drag, null);
    model.startDrag(s, dragOf(0));
    model.moveDrag(s, 5, 7);
    assert.deepEqual([s.drag.x, s.drag.y], [5, 7]);
});

test('moveCursor moves by cells and stops at the edges', () => {
    const s = model.createState({ rows: 2, cols: 3 });
    model.moveCursor(s, 0, -1);
    assert.equal(s.cursor, 0);
    model.moveCursor(s, 1, 2);
    assert.equal(s.cursor, 5);
    model.moveCursor(s, 1, 1);
    assert.equal(s.cursor, 5);
});

test('activateCell picks up, swaps, puts back and ignores empty cells', () => {
    const s = model.createState({ rows: 1, cols: 4 });
    model.replaceImages(s, [img('a'), img('b'), img('c')]);

    assert.equal(model.activateCell(s, 3), 'none');      // empty cell
    assert.equal(s.selected, null);
    assert.equal(model.activateCell(s, 0), 'picked');
    assert.equal(model.activateCell(s, 3), 'none');      // empty: keeps the pick
    assert.equal(s.selected, 0);
    assert.equal(model.activateCell(s, 2), 'swapped');
    assert.deepEqual(names(s), ['c', 'b', 'a']);
    assert.equal(s.selected, null);
    assert.equal(s.cursor, 2);

    model.activateCell(s, 1);
    assert.equal(model.activateCell(s, 1), 'put-back');
    assert.deepEqual(names(s), ['c', 'b', 'a']);
});

test('grid and image changes drop the pick and keep the cursor in range', () => {
    const s = model.createState({ rows: 2, cols: 4 });
    model.replaceImages(s, [img('a'), img('b')]);
    model.activateCell(s, 1);
    s.cursor = 7;
    model.setGridSize(s, 1, 2);
    assert.equal(s.selected, null);
    assert.equal(s.cursor, 1);
});

test('a drag swap drops a stale pick', () => {
    const s = model.createState({ rows: 1, cols: 3 });
    model.replaceImages(s, [img('a'), img('b'), img('c')]);
    model.activateCell(s, 0);
    model.startDrag(s, dragOf(1));
    model.finishDrag(s, 2);
    assert.equal(s.selected, null);
});
