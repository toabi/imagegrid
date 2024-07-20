const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const fileInput = document.getElementById('fileInput');
const downloadBtn = document.getElementById('downloadBtn');

let images = [];
let imagePositions = [];
let displayGridWidth = 200;
let displayGridHeight = 200;
let draggedImageIndex = null;
let gridCols, gridRows;
let maxCanvasWidth, maxCanvasHeight;

const POSITION_THRESHOLD = 1; // 1 pixel threshold

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
    maxCanvasHeight = window.innerHeight * 0.8;
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

    const scaleX = maxCanvasWidth / gridWidth;
    const scaleY = maxCanvasHeight / gridHeight;
    const scale = Math.min(scaleX, scaleY, 1);

    displayGridWidth = maxWidth * scale;
    displayGridHeight = maxHeight * scale;

    canvas.width = displayGridWidth * gridCols;
    canvas.height = displayGridHeight * gridRows;
}

function repositionImages() {
    imagePositions = images.map((img, index) => {
        const col = index % gridCols;
        const row = Math.floor(index / gridCols);
        return {
            x: col * displayGridWidth,
            y: row * displayGridHeight
        };
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

    function handleStart(e) {
        e.preventDefault();
        const touch = e.touches ? e.touches[0] : e;
        const rect = canvas.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;

        console.log('Touch start:', x, y); // Add this line for debugging

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
    }

    function handleMove(e) {
        if (draggedImageIndex !== null) {
            e.preventDefault();
            const touch = e.touches ? e.touches[0] : e;
            const rect = canvas.getBoundingClientRect();
            const x = touch.clientX - rect.left;
            const y = touch.clientY - rect.top;

            const pos = imagePositions[draggedImageIndex];
            pos.x = x - offsetX;
            pos.y = y - offsetY;
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

    canvas.addEventListener('mousedown', handleStart);
    canvas.addEventListener('mousemove', handleMove);
    canvas.addEventListener('mouseup', handleEnd);

    canvas.addEventListener('touchstart', handleStart);
    canvas.addEventListener('touchmove', handleMove);
    canvas.addEventListener('touchend', handleEnd);
}

function arePositionsEqual(pos1, pos2) {
    return Math.abs(pos1.x - pos2.x) < POSITION_THRESHOLD &&
        Math.abs(pos1.y - pos2.y) < POSITION_THRESHOLD;
}

function snapToGrid(index) {
    const pos = imagePositions[index];
    const targetX = Math.round(pos.x / displayGridWidth) * displayGridWidth;
    const targetY = Math.round(pos.y / displayGridHeight) * displayGridHeight;

    pos.x = Math.max(0, Math.min(targetX, canvas.width - displayGridWidth));
    pos.y = Math.max(0, Math.min(targetY, canvas.height - displayGridHeight));

    const targetIndex = imagePositions.findIndex((p, i) =>
        i !== index &&
        Math.abs(p.x - pos.x) < displayGridWidth / 2 &&
        Math.abs(p.y - pos.y) < displayGridHeight / 2
    );

    if (targetIndex >= 0) {
        const tempPos = { ...imagePositions[targetIndex] };
        imagePositions[targetIndex] = { ...imagePositions[index] };
        imagePositions[index] = tempPos;

        const tempImg = images[targetIndex];
        images[targetIndex] = images[index];
        images[index] = tempImg;
    }

    repositionImages();
    drawImages();
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

    images.forEach((img, index) => {
        const pos = imagePositions[index];
        const x = (pos.x / displayGridWidth) * maxWidth;
        const y = (pos.y / displayGridHeight) * maxHeight;
        originalCtx.drawImage(img, x, y);
    });

    const link = document.createElement('a');
    link.download = 'combined-image.png';
    link.href = originalCanvas.toDataURL();
    link.click();
}