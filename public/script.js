const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const fileInput = document.getElementById('fileInput');
const downloadBtn = document.getElementById('downloadBtn');

let images = [];
let imagePositions = [];
let displayGridWidth = 200; // Default width of each grid cell for display purposes
let displayGridHeight = 200; // Default height of each grid cell for display purposes
let draggedImageIndex = null; // Index of the image being dragged

fileInput.addEventListener('change', handleFileSelect);
downloadBtn.addEventListener('click', downloadImage);
canvas.addEventListener('dragover', handleDragOver);
canvas.addEventListener('drop', handleDrop);

function handleFileSelect(event) {
    const files = event.target.files;
    if (files.length > 8) {
        alert('Please upload up to 8 images.');
        return;
    }

    images = [];
    imagePositions = [];

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const reader = new FileReader();

        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                if (images.length === 0) {
                    // Set the display grid size based on the aspect ratio of the first image
                    const aspectRatio = img.width / img.height;
                    displayGridWidth = 200 * aspectRatio;
                    displayGridHeight = 200;
                    updateCanvasSize();
                }
                images.push(img);
                // Calculate initial positions in a grid
                const col = i % 4;
                const row = Math.floor(i / 4);
                imagePositions.push({ x: col * displayGridWidth, y: row * displayGridHeight });
                if (images.length === files.length) {
                    drawImages();
                    enableDragAndDrop();
                }
            }
            img.src = e.target.result;
        }

        reader.readAsDataURL(file);
    }
}

function updateCanvasSize() {
    canvas.width = displayGridWidth * 4;
    canvas.height = displayGridHeight * 2;
}

function handleDragOver(e) {
    e.preventDefault();
}

function handleDrop(e) {
    e.preventDefault();
    const dataTransfer = e.dataTransfer;
    const files = dataTransfer.files;

    if (files.length + images.length > 8) {
        alert('Please upload a total of up to 8 images.');
        return;
    }

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const reader = new FileReader();

        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                images.push(img);
                // Position based on drop location
                imagePositions.push({ x: e.offsetX - displayGridWidth / 2, y: e.offsetY - displayGridHeight / 2 });
                drawImages();
                enableDragAndDrop();
            }
            img.src = e.target.result;
        }

        reader.readAsDataURL(file);
    }
}

function drawImages() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    images.forEach((img, index) => {
        if (index !== draggedImageIndex) {
            const pos = imagePositions[index];
            drawImageWithAspectRatio(img, pos.x, pos.y, displayGridWidth, displayGridHeight);
        }
    });
    if (draggedImageIndex !== null) {
        const pos = imagePositions[draggedImageIndex];
        drawImageWithAspectRatio(images[draggedImageIndex], pos.x, pos.y, displayGridWidth, displayGridHeight);
    }
}

function drawImageWithAspectRatio(img, x, y, maxWidth, maxHeight) {
    const widthRatio = maxWidth / img.width;
    const heightRatio = maxHeight / img.height;
    const bestRatio = Math.min(widthRatio, heightRatio);

    const newWidth = img.width * bestRatio;
    const newHeight = img.height * bestRatio;

    const offsetX = (maxWidth - newWidth) / 2;
    const offsetY = (maxHeight - newHeight) / 2;

    ctx.drawImage(img, x + offsetX, y + offsetY, newWidth, newHeight);
}

function enableDragAndDrop() {
    let offsetX = 0;
    let offsetY = 0;

    canvas.addEventListener('mousedown', (e) => {
        const { offsetX: x, offsetY: y } = e;
        draggedImageIndex = imagePositions
            .map((pos, index) => ({ pos, index }))
            .filter(({ pos }) => {
                const img = images[imagePositions.indexOf(pos)];
                const widthRatio = displayGridWidth / img.width;
                const heightRatio = displayGridHeight / img.height;
                const bestRatio = Math.min(widthRatio, heightRatio);
                const newWidth = img.width * bestRatio;
                const newHeight = img.height * bestRatio;
                const offsetX = (displayGridWidth - newWidth) / 2;
                const offsetY = (displayGridHeight - newHeight) / 2;
                return x >= pos.x + offsetX && x <= pos.x + offsetX + newWidth && y >= pos.y + offsetY && y <= pos.y + offsetY + newHeight;
            })
            .sort((a, b) => b.index - a.index) // Select the top-most image
            .map(({ index }) => index)[0];

        if (draggedImageIndex >= 0) {
            const pos = imagePositions[draggedImageIndex];
            offsetX = x - pos.x;
            offsetY = y - pos.y;
        }
    });

    canvas.addEventListener('mousemove', (e) => {
        if (draggedImageIndex !== null) {
            const { offsetX: x, offsetY: y } = e;
            const pos = imagePositions[draggedImageIndex];
            pos.x = x - offsetX;
            pos.y = y - offsetY;
            drawImages();
        }
    });

    canvas.addEventListener('mouseup', () => {
        if (draggedImageIndex !== null) {
            snapToGrid(draggedImageIndex);
            draggedImageIndex = null;
            drawImages();
        }
    });
}

function snapToGrid(index) {
    const pos = imagePositions[index];
    const targetX = Math.round(pos.x / displayGridWidth) * displayGridWidth;
    const targetY = Math.round(pos.y / displayGridHeight) * displayGridHeight;

    const targetIndex = imagePositions.findIndex((p, i) => i !== index && p.x === targetX && p.y === targetY);

    if (targetIndex >= 0) {
        // Swap positions
        const tempPos = { ...imagePositions[index] };
        imagePositions[index] = { ...imagePositions[targetIndex] };
        imagePositions[targetIndex] = tempPos;
    } else {
        // Snap to closest grid position
        pos.x = targetX;
        pos.y = targetY;
    }
}

function downloadImage() {
    const originalCanvas = document.createElement('canvas');
    const originalCtx = originalCanvas.getContext('2d');

    // Calculate the dimensions of the final image
    const rows = 2;
    const cols = 4;
    const maxWidth = Math.max(...images.map(img => img.width));
    const maxHeight = Math.max(...images.map(img => img.height));

    originalCanvas.width = maxWidth * cols;
    originalCanvas.height = maxHeight * rows;

    // Draw each image in its original size on the new canvas
    images.forEach((img, index) => {
        const pos = imagePositions[index];
        const col = Math.floor(pos.x / displayGridWidth);
        const row = Math.floor(pos.y / displayGridHeight);
        originalCtx.drawImage(img, col * maxWidth, row * maxHeight);
    });

    // Download the combined image
    const link = document.createElement('a');
    link.download = 'combined-image.png';
    link.href = originalCanvas.toDataURL();
    link.click();
}