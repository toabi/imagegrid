// Building the full-resolution combined image.
import { largestSize, limitScale } from './layout.js';
import { drawGrid } from './render.js';

// Canvas limits to try in order. The first matches desktop Chrome/Firefox; the
// second is safe on every current browser, including iOS Safari.
const CANVAS_LIMITS = [
    { maxSide: 32767, maxArea: 268435456 },
    { maxSide: 16384, maxArea: 16777216 }
];

// Renders the images into a rows × cols grid at their original resolution
// (cells are as large as the largest image), laid out exactly like the preview.
// Resolves with { blob, scaled } or null if the browser can't produce it.
export async function renderGridToBlob(images, rows, cols, type = 'image/png') {
    const content = largestSize(images);
    for (const limits of CANVAS_LIMITS) {
        const scale = limitScale(content.width * cols, content.height * rows, limits);
        const grid = {
            rows,
            cols,
            cellWidth: Math.max(1, Math.floor(content.width * scale)),
            cellHeight: Math.max(1, Math.floor(content.height * scale))
        };

        const canvas = document.createElement('canvas');
        canvas.width = grid.cellWidth * cols;
        canvas.height = grid.cellHeight * rows;
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;
        ctx.imageSmoothingQuality = 'high';
        drawGrid(ctx, grid, images);

        const blob = await new Promise((resolve) => canvas.toBlob(resolve, type));
        // Release the (possibly huge) backing store right away.
        canvas.width = canvas.height = 0;
        if (blob) return { blob, scaled: scale < 1 };
    }
    return null;
}

// How long the download URL stays valid. Some browsers (iOS Safari) ask the
// user to confirm a download and only read the URL afterwards, so this is
// generous; FileSaver.js uses the same delay.
const DOWNLOAD_URL_LIFETIME_MS = 40_000;

export function saveBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = filename;
    link.href = url;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), DOWNLOAD_URL_LIFETIME_MS);
}
