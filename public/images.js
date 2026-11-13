// Turning user-supplied files into drawable images.

export function isImageFile(file) {
    return file.type.startsWith('image/');
}

// Resolves with the decoded image, or null if the file can't be decoded.
export function loadImage(file) {
    return new Promise((resolve) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(url);
            resolve(img);
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
