// Turning user-supplied files into drawable images.

export function isImageFile(file) {
    return file.type.startsWith('image/');
}

// Resolves with the decoded image, or null if the file can't be decoded or
// has no intrinsic size (e.g. an SVG with only a viewBox), which can't be laid out.
export function loadImage(file) {
    return new Promise((resolve) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(url);
            resolve(img.naturalWidth > 0 && img.naturalHeight > 0 ? img : null);
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            resolve(null);
        };
        img.src = url;
    });
}

// Loads all files in their original order. Files that fail are left out and counted.
export async function loadImages(files) {
    const results = await Promise.all(files.map(loadImage));
    const loaded = results.filter(Boolean);
    return { loaded, failed: results.length - loaded.length };
}
