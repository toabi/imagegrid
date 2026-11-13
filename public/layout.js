// Pure layout maths shared by the on-screen preview, hit-testing and export.
// Nothing in here touches the DOM, so it can be unit-tested with `node --test`.

export const GRID_MIN = 1;
export const GRID_MAX = 8;

export function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

// Clamps a grid dimension to GRID_MIN..GRID_MAX; anything non-numeric becomes GRID_MIN.
export function clampGridSize(n) {
    if (!Number.isFinite(n)) return GRID_MIN;
    return clamp(Math.round(n), GRID_MIN, GRID_MAX);
}

// Largest width and largest height among the given images (each { width, height }).
export function largestSize(images) {
    return images.reduce((acc, img) => ({
        width: Math.max(acc.width, img.width),
        height: Math.max(acc.height, img.height)
    }), { width: 0, height: 0 });
}

// Rectangle of the cell at `index`, filling the grid row by row.
export function cellRect(index, grid) {
    return {
        x: (index % grid.cols) * grid.cellWidth,
        y: Math.floor(index / grid.cols) * grid.cellHeight,
        width: grid.cellWidth,
        height: grid.cellHeight
    };
}

// Scales a source of size srcWidth × srcHeight to fit inside `box`, keeping its
// aspect ratio, and centres it.
export function fitRect(srcWidth, srcHeight, box) {
    const scale = Math.min(box.width / srcWidth, box.height / srcHeight);
    const width = srcWidth * scale;
    const height = srcHeight * scale;
    return {
        x: box.x + (box.width - width) / 2,
        y: box.y + (box.height - height) / 2,
        width,
        height
    };
}

// Cell size for the on-screen preview. Cells take the aspect ratio of the
// largest image dimensions and are scaled down (never up) to fit the space.
// With no content, a fixed placeholder cell size is used. Either way the
// shorter side never drops below `minCell`, so every cell stays a usable
// touch target (the canvas then scrolls instead).
export function previewCellSize({ content, rows, cols, maxWidth, maxHeight, emptyCell = 120, minCell = 0 }) {
    let size;
    if (!content || content.width === 0 || content.height === 0) {
        size = {
            width: Math.min(emptyCell, maxWidth / cols),
            height: Math.min(emptyCell, maxHeight / rows)
        };
    } else {
        const scale = Math.min(
            maxWidth / (content.width * cols),
            maxHeight / (content.height * rows),
            1
        );
        size = { width: content.width * scale, height: content.height * scale };
    }
    const grow = Math.max(1, minCell / Math.min(size.width, size.height));
    return { width: size.width * grow, height: size.height * grow };
}

// Index of the cell containing (x, y), clamped to the grid so points outside
// it map to the nearest edge cell.
export function cellIndexAt(x, y, grid) {
    const col = clamp(Math.floor(x / grid.cellWidth), 0, grid.cols - 1);
    const row = clamp(Math.floor(y / grid.cellHeight), 0, grid.rows - 1);
    return row * grid.cols + col;
}

// Cell the dragged image lands in, judged by the centre of its cell-sized box,
// or -1 when the drop shouldn't move anything (its own cell or an empty cell).
export function dropTargetIndex(drag, grid, imageCount) {
    const centreX = drag.x - drag.offsetX + grid.cellWidth / 2;
    const centreY = drag.y - drag.offsetY + grid.cellHeight / 2;
    const target = cellIndexAt(centreX, centreY, grid);
    return target !== drag.index && target < imageCount ? target : -1;
}

// Index of the image drawn under (x, y), or -1 if the point is on empty space
// (outside the grid, in an empty cell, or in the letterbox around an image).
export function imageIndexAt(x, y, images, grid) {
    if (x < 0 || y < 0 || x >= grid.cols * grid.cellWidth || y >= grid.rows * grid.cellHeight) {
        return -1;
    }
    const index = cellIndexAt(x, y, grid);
    const img = images[index];
    if (!img) return -1;
    const r = fitRect(img.width, img.height, cellRect(index, grid));
    const inside = x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height;
    return inside ? index : -1;
}

// Factor (≤ 1) by which a width × height canvas must shrink to stay within
// the given side-length and area limits.
export function limitScale(width, height, { maxSide, maxArea }) {
    if (width <= 0 || height <= 0) return 1;
    return Math.min(1, maxSide / width, maxSide / height, Math.sqrt(maxArea / (width * height)));
}
