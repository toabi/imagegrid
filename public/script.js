const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const fileInput = document.getElementById('fileInput');
const downloadBtn = document.getElementById('downloadBtn');
const messageContainer = document.getElementById('message-container');

const GRID_MIN = 1;
const GRID_MAX = 8;
let configRows = 2;
let configCols = 4;

function getMaxImages() {
    return configRows * configCols;
}

function getVisibleCount() {
    return Math.min(images.length, getMaxImages());
}

function getVisibleImages() {
    return images.slice(0, getVisibleCount());
}

let images = [];
let imagePositions = [];
let displayGridWidth = 200;
let displayGridHeight = 200;
let draggedImageIndex = null;
let gridCols, gridRows;
let maxCanvasWidth, maxCanvasHeight;

fileInput.addEventListener('change', handleFileSelect);
downloadBtn.addEventListener('click', downloadImage);
canvas.addEventListener('dragover', handleDragOver);
canvas.addEventListener('dragleave', handleDragLeave);
canvas.addEventListener('drop', handleDrop);
window.addEventListener('resize', handleResize);

function calculateGridSize() {
    gridCols = configCols;
    gridRows = configRows;
}

function setGridDimensions(rows, cols) {
    configRows = Math.max(GRID_MIN, Math.min(GRID_MAX, rows));
    configCols = Math.max(GRID_MIN, Math.min(GRID_MAX, cols));

    calculateGridSize();
    calculateMaxCanvasSize();
    updateCanvasSize();
    repositionImages();
    drawImages();
    enableDragAndDrop();
    updateMessageVisibility();
}

function handleFileSelect(event) {
    const files = Array.from(event.target.files).slice(0, getMaxImages());
    if (files.length === 0) return;

    resetImageState();
    calculateGridSize();
    calculateMaxCanvasSize();

    Promise.all(files.map(loadImage))
        .then(() => {
            updateCanvasSize();
            repositionImages();
            drawImages();
            enableDragAndDrop();
            updateMessageVisibility();
        });
}

function resetImageState() {
    images = [];
    imagePositions = [];
}

function loadImage(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                images.push(img);
                resolve();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

function calculateMaxCanvasSize() {
    maxCanvasWidth = window.innerWidth * 0.9;
    maxCanvasHeight = window.innerHeight * 0.8;
}

function updateCanvasSize() {
    calculateMaxCanvasSize();

    const maxDimensions = getVisibleImages().reduce((acc, img) => ({
        width: Math.max(acc.width, img.width),
        height: Math.max(acc.height, img.height)
    }), { width: 0, height: 0 });

    if (images.length === 0) {
        const cell = 120;
        displayGridWidth = Math.min(cell, maxCanvasWidth / gridCols);
        displayGridHeight = Math.min(cell, maxCanvasHeight / gridRows);
        canvas.width = displayGridWidth * gridCols;
        canvas.height = displayGridHeight * gridRows;
        return;
    }

    const gridWidth = maxDimensions.width * gridCols;
    const gridHeight = maxDimensions.height * gridRows;

    const scale = Math.min(maxCanvasWidth / gridWidth, maxCanvasHeight / gridHeight, 1);

    displayGridWidth = maxDimensions.width * scale;
    displayGridHeight = maxDimensions.height * scale;

    canvas.width = displayGridWidth * gridCols;
    canvas.height = displayGridHeight * gridRows;
}

function repositionImages() {
    imagePositions = getVisibleImages().map((_, index) => ({
        x: (index % gridCols) * displayGridWidth,
        y: Math.floor(index / gridCols) * displayGridHeight
    }));
}

function handleDragOver(e) {
    e.preventDefault();
    canvas.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.preventDefault();
    canvas.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    canvas.classList.remove('drag-over');
    const files = Array.from(e.dataTransfer.files);
    if (images.length + files.length > getMaxImages()) {
        alert(`Please upload a total of up to ${getMaxImages()} images.`);
        return;
    }

    calculateMaxCanvasSize();

    Promise.all(files.map(loadImage))
        .then(() => {
            calculateGridSize();
            updateCanvasSize();
            repositionImages();
            drawImages();
            enableDragAndDrop();
            updateMessageVisibility();
        });
}

function drawImages() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const visibleCount = getVisibleCount();
    images.forEach((img, index) => {
        if (index < visibleCount && index !== draggedImageIndex) {
            drawImageWithAspectRatio(img, imagePositions[index]);
        }
    });
    if (draggedImageIndex !== null) {
        drawImageWithAspectRatio(images[draggedImageIndex], imagePositions[draggedImageIndex]);
    }
}

function handleResize() {
    if (images.length > 0) {
        updateCanvasSize();
        repositionImages();
        drawImages();
    }
}

function drawImageWithAspectRatio(img, pos) {
    const widthRatio = displayGridWidth / img.width;
    const heightRatio = displayGridHeight / img.height;
    const bestRatio = Math.min(widthRatio, heightRatio);

    const newWidth = img.width * bestRatio;
    const newHeight = img.height * bestRatio;

    const offsetX = (displayGridWidth - newWidth) / 2;
    const offsetY = (displayGridHeight - newHeight) / 2;

    ctx.drawImage(img, pos.x + offsetX, pos.y + offsetY, newWidth, newHeight);
}

function enableDragAndDrop() {
    let offsetX = 0;
    let offsetY = 0;

    canvas.addEventListener('mousedown', handleStart);
    canvas.addEventListener('mousemove', handleMove);
    canvas.addEventListener('mouseup', handleEnd);

    canvas.addEventListener('touchstart', handleStart);
    canvas.addEventListener('touchmove', handleMove);
    canvas.addEventListener('touchend', handleEnd);

    function handleStart(e) {
        e.preventDefault();
        const { x, y } = getCanvasCoordinates(e);
        draggedImageIndex = findDraggedImageIndex(x, y);

        if (draggedImageIndex >= 0) {
            const pos = imagePositions[draggedImageIndex];
            offsetX = x - pos.x;
            offsetY = y - pos.y;
        }
    }

    function handleMove(e) {
        if (draggedImageIndex !== null) {
            e.preventDefault();
            const { x, y } = getCanvasCoordinates(e);
            updateDraggedImagePosition(x, y, offsetX, offsetY);
            drawImages();
        }
    }

    function handleEnd() {
        if (draggedImageIndex !== null) {
            snapToGrid(draggedImageIndex);
            draggedImageIndex = null;
            repositionImages();
            drawImages();
        }
    }
}

function getCanvasCoordinates(e) {
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches ? e.touches[0] : e;
    return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top
    };
}

function findDraggedImageIndex(x, y) {
    return imagePositions
        .map((pos, index) => ({ pos, index }))
        .filter(({ pos }) => isPointInsideImage(x, y, pos))
        .sort((a, b) => b.index - a.index)
        .map(({ index }) => index)[0] ?? -1;
}

function isPointInsideImage(x, y, pos) {
    const img = images[imagePositions.indexOf(pos)];
    const { width: newWidth, height: newHeight } = getScaledImageDimensions(img);
    const offsetX = (displayGridWidth - newWidth) / 2;
    const offsetY = (displayGridHeight - newHeight) / 2;
    return x >= pos.x + offsetX && x <= pos.x + offsetX + newWidth &&
        y >= pos.y + offsetY && y <= pos.y + offsetY + newHeight;
}

function getScaledImageDimensions(img) {
    const widthRatio = displayGridWidth / img.width;
    const heightRatio = displayGridHeight / img.height;
    const bestRatio = Math.min(widthRatio, heightRatio);
    return {
        width: img.width * bestRatio,
        height: img.height * bestRatio
    };
}

function updateDraggedImagePosition(x, y, offsetX, offsetY) {
    const pos = imagePositions[draggedImageIndex];
    pos.x = x - offsetX;
    pos.y = y - offsetY;
}

function snapToGrid(index) {
    const pos = imagePositions[index];
    pos.x = Math.max(0, Math.min(Math.round(pos.x / displayGridWidth) * displayGridWidth, canvas.width - displayGridWidth));
    pos.y = Math.max(0, Math.min(Math.round(pos.y / displayGridHeight) * displayGridHeight, canvas.height - displayGridHeight));

    const targetIndex = findTargetImageIndex(index, pos);

    if (targetIndex >= 0) {
        swapImagesAndPositions(index, targetIndex);
    }

    repositionImages();
    drawImages();
}

function findTargetImageIndex(index, pos) {
    return imagePositions.findIndex((p, i) =>
        i !== index &&
        Math.abs(p.x - pos.x) < displayGridWidth / 2 &&
        Math.abs(p.y - pos.y) < displayGridHeight / 2
    );
}

function swapImagesAndPositions(index1, index2) {
    [imagePositions[index1], imagePositions[index2]] = [imagePositions[index2], imagePositions[index1]];
    [images[index1], images[index2]] = [images[index2], images[index1]];
}

function downloadImage() {
    const originalCanvas = document.createElement('canvas');
    const originalCtx = originalCanvas.getContext('2d');

    const visibleImages = getVisibleImages();
    const maxDimensions = visibleImages.reduce((acc, img) => ({
        width: Math.max(acc.width, img.width),
        height: Math.max(acc.height, img.height)
    }), { width: 0, height: 0 });

    originalCanvas.width = maxDimensions.width * gridCols;
    originalCanvas.height = maxDimensions.height * gridRows;

    visibleImages.forEach((img, index) => {
        const pos = imagePositions[index];
        const x = (pos.x / displayGridWidth) * maxDimensions.width;
        const y = (pos.y / displayGridHeight) * maxDimensions.height;
        originalCtx.drawImage(img, x, y);
    });

    const link = document.createElement('a');
    link.download = 'combined-image.png';
    link.href = originalCanvas.toDataURL();
    link.click();
}

function updateMessageVisibility() {
    if (images.length === 0) {
        messageContainer.style.display = 'block';
    } else {
        messageContainer.style.display = 'none';
    }
}

// Stepper controls for grid dimensions
const rowsValue = document.getElementById('rowsValue');
const colsValue = document.getElementById('colsValue');
const rowsDec = document.getElementById('rowsDec');
const rowsInc = document.getElementById('rowsInc');
const colsDec = document.getElementById('colsDec');
const colsInc = document.getElementById('colsInc');

function updateStepperUI() {
    rowsValue.textContent = configRows;
    colsValue.textContent = configCols;
    rowsDec.disabled = configRows <= GRID_MIN;
    rowsInc.disabled = configRows >= GRID_MAX;
    colsDec.disabled = configCols <= GRID_MIN;
    colsInc.disabled = configCols >= GRID_MAX;
}

function changeDimensions(rows, cols) {
    setGridDimensions(rows, cols);
    updateStepperUI();
}

rowsDec.addEventListener('click', () => changeDimensions(configRows - 1, configCols));
rowsInc.addEventListener('click', () => changeDimensions(configRows + 1, configCols));
colsDec.addEventListener('click', () => changeDimensions(configRows, configCols - 1));
colsInc.addEventListener('click', () => changeDimensions(configRows, configCols + 1));

// Initialize grid and canvas with default dimensions
calculateGridSize();
calculateMaxCanvasSize();
updateCanvasSize();
updateMessageVisibility();
updateStepperUI();