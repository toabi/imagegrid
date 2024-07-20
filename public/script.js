const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const fileInput = document.getElementById('fileInput');
const downloadBtn = document.getElementById('downloadBtn');

let images = [];
let imagePositions = [];
let displayGridWidth = 200; // Will be updated based on actual image sizes
let displayGridHeight = 200; // Will be updated based on actual image sizes
let draggedImageIndex = null;
let gridCols, gridRows;
let maxCanvasWidth, maxCanvasHeight;

fileInput.addEventListener('change', handleFileSelect);
downloadBtn.addEventListener('click', downloadImage);
canvas.addEventListener('dragover', handleDragOver);
canvas.addEventListener('drop', handleDrop);

function calculateGridSize(imageCount) {
    if (imageCount <= 4) {
        gridCols = imageCount;
        gridRows = 1;
    } else {
        gridCols = 4;
        gridRows = Math.ceil(imageCount / 4);
    }
}

function handleFileSelect(event) {
    const files = event.target.files;
    if (files.length > 8) {
        alert('Please upload up to 8 images.');
        return;
    }

    images = [];
    imagePositions = [];

    calculateGridSize(files.length);
    calculateMaxCanvasSize();

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const reader = new FileReader();

        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                images.push(img);
                if (images.length === files.length) {
                    updateCanvasSize();
                    repositionImages();
                    drawImages();
                    enableDragAndDrop();
                }
            }
            img.src = e.target.result;
        }

        reader.readAsDataURL(file);
    }
}

function calculateMaxCanvasSize() {
    maxCanvasWidth = window.innerWidth * 0.9;
    maxCanvasHeight = window.innerHeight * 0.9;
}


function updateCanvasSize() {
    calculateMaxCanvasSize();

    let maxWidth = 0;
    let maxHeight = 0;

    images.forEach(img => {
        maxWidth = Math.max(maxWidth, img.width);
        maxHeight = Math.max(maxHeight, img.height);
    });

    let gridWidth = maxWidth * gridCols;
    let gridHeight = maxHeight * gridRows;

    // Calculate the scaling factor to fit within the maximum canvas size
    const scaleX = maxCanvasWidth / gridWidth;
    const scaleY = maxCanvasHeight / gridHeight;
    const scale = Math.min(scaleX, scaleY, 1); // Don't scale up if images are smaller

    displayGridWidth = maxWidth * scale;
    displayGridHeight = maxHeight * scale;

    canvas.width = displayGridWidth * gridCols;
    canvas.height = displayGridHeight * gridRows;
}


function repositionImages() {
    imagePositions = images.map((img, index) => {
        const col = index % gridCols;
        const row = Math.floor(index / gridCols);
        return { x: col * displayGridWidth, y: row * displayGridHeight };
    });
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

    calculateMaxCanvasSize();

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const reader = new FileReader();

        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                images.push(img);
                imagePositions.push({ x: e.offsetX - displayGridWidth / 2, y: e.offsetY - displayGridHeight / 2 });
                calculateGridSize(images.length);
                updateCanvasSize();
                repositionImages();
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

// Add an event listener for window resize
window.addEventListener('resize', () => {
    if (images.length > 0) {
        updateCanvasSize();
        repositionImages();
        drawImages();
    }
});

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
            .sort((a, b) => b.index - a.index)
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

    // Ensure the image stays within the canvas bounds
    pos.x = Math.max(0, Math.min(targetX, canvas.width - displayGridWidth));
    pos.y = Math.max(0, Math.min(targetY, canvas.height - displayGridHeight));

    const targetIndex = imagePositions.findIndex((p, i) => i !== index && p.x === pos.x && p.y === pos.y);

    if (targetIndex >= 0) {
        // Swap positions
        const tempPos = { ...imagePositions[index] };
        imagePositions[index] = { ...imagePositions[targetIndex] };
        imagePositions[targetIndex] = tempPos;
    }
}
function downloadImage() {
    const originalCanvas = document.createElement('canvas');
    const originalCtx = originalCanvas.getContext('2d');

    let maxWidth = 0;
    let maxHeight = 0;

    images.forEach(img => {
        maxWidth = Math.max(maxWidth, img.width);
        maxHeight = Math.max(maxHeight, img.height);
    });

    originalCanvas.width = maxWidth * gridCols;
    originalCanvas.height = maxHeight * gridRows;

    // Draw each image in its original size on the new canvas
    images.forEach((img, index) => {
        const pos = imagePositions[index];
        const x = (pos.x / displayGridWidth) * maxWidth;
        const y = (pos.y / displayGridHeight) * maxHeight;
        originalCtx.drawImage(img, x, y);
    });

    // Download the combined image
    const link = document.createElement('a');
    link.download = 'combined-image.png';
    link.href = originalCanvas.toDataURL();
    link.click();
}