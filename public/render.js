// Canvas drawing for both the preview and the export.
import { cellRect, fitRect } from './layout.js';

// Draws `img` scaled to fit and centred inside `box`.
export function drawFitted(ctx, img, box) {
    const r = fitRect(img.width, img.height, box);
    ctx.drawImage(img, r.x, r.y, r.width, r.height);
}

// Outlines `box`, `inset` px inside its edge, with a ring that is visible on
// any image: a coloured ring on a contrasting backing ring. `dashed`
// distinguishes rings by shape, not colour alone.
function drawRing(ctx, box, { inset, color, backing, dashed = false }) {
    const x = box.x + inset;
    const y = box.y + inset;
    const width = box.width - 2 * inset;
    const height = box.height - 2 * inset;
    ctx.save();
    ctx.lineWidth = 6;
    ctx.strokeStyle = backing;
    ctx.strokeRect(x, y, width, height);
    ctx.lineWidth = 3;
    ctx.strokeStyle = color;
    ctx.setLineDash(dashed ? [8, 5] : []);
    ctx.strokeRect(x, y, width, height);
    ctx.restore();
}

// Preview-only markers: a dashed outer ring around the picked-up image and a
// solid inner ring around the keyboard cursor (only while the grid has
// focus), so both stay visible when they are on the same cell.
export function drawMarkers(ctx, grid, { selected, cursor, showCursor, colors }) {
    if (selected !== null) {
        drawRing(ctx, cellRect(selected, grid), { inset: 3, color: colors.selected, backing: colors.backing, dashed: true });
    }
    if (showCursor) {
        drawRing(ctx, cellRect(cursor, grid), { inset: 9, color: colors.cursor, backing: colors.backing });
    }
}

// Draws every image into its cell. While dragging, the dragged image is drawn
// last, following the pointer, and its own cell is left empty.
export function drawGrid(ctx, grid, images, drag = null) {
    ctx.clearRect(0, 0, grid.cols * grid.cellWidth, grid.rows * grid.cellHeight);
    images.forEach((img, index) => {
        if (drag && drag.index === index) return;
        drawFitted(ctx, img, cellRect(index, grid));
    });
    if (drag) {
        drawFitted(ctx, images[drag.index], {
            x: drag.x - drag.offsetX,
            y: drag.y - drag.offsetY,
            width: grid.cellWidth,
            height: grid.cellHeight
        });
    }
}
