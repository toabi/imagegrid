// Canvas drawing for both the preview and the export.
import { cellRect, fitRect } from './layout.js';

// Draws `img` scaled to fit and centred inside `box`.
export function drawFitted(ctx, img, box) {
    const r = fitRect(img.width, img.height, box);
    ctx.drawImage(img, r.x, r.y, r.width, r.height);
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
