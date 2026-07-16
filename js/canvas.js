export class DrawingCanvas {
    constructor(existingImage = null) {
        this.canvas = null;
        this.ctx = null;
        this.isDrawing = false;
        this.currentTool = 'brush';
        this.brushColor = '#ff2d95';
        this.brushSize = 5;
        this.bgColor = '#ffffff';
        this.undoStack = [];
        this.existingImage = existingImage;
        this.bgImage = null;
        this.init();
    }

    init() {
        this.canvas = document.getElementById('drawCanvas');
        if (!this.canvas) return;
        
        this.ctx = this.canvas.getContext('2d');
        
        // Установка размера canvas
        this.canvas.width = Math.min(window.innerWidth, 600);
        this.canvas.height = Math.min(window.innerHeight - 250, 500);
        
        // Заливаем фон
        this.ctx.fillStyle = this.bgColor;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.saveBgImage();
        
        // Если есть существующее изображение - загружаем его
        if (this.existingImage) {
            const img = new Image();
            img.onload = () => {
                this.ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height);
                this.saveState();
            };
            img.src = this.existingImage;
        } else {
            this.saveState();
        }
        
        this.setupEvents();
        this.setupTools();
    }

    saveBgImage() {
        this.bgImage = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    }

    setupEvents() {
        this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
        this.canvas.addEventListener('mousemove', (e) => this.draw(e));
        this.canvas.addEventListener('mouseup', () => this.stopDrawing());
        this.canvas.addEventListener('mouseout', () => this.stopDrawing());
        
        // Touch events
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.startDrawing(e.touches[0]);
        });
        
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            this.draw(e.touches[0]);
        });
        
        this.canvas.addEventListener('touchend', () => this.stopDrawing());
    }

    setupTools() {
        const colorPicker = document.getElementById('colorPicker');
        const bgColorPicker = document.getElementById('bgColorPicker');
        const sizeSlider = document.getElementById('sizeSlider');
        const sizeValue = document.getElementById('sizeValue');
        
        colorPicker?.addEventListener('input', (e) => {
            this.brushColor = e.target.value;
        });
        
        bgColorPicker?.addEventListener('input', (e) => {
            this.changeBackground(e.target.value);
        });
        
        sizeSlider?.addEventListener('input', (e) => {
            this.brushSize = parseInt(e.target.value);
            if (sizeValue) sizeValue.textContent = `${e.target.value}px`;
        });
        
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelector('.tool-btn.active')?.classList.remove('active');
                btn.classList.add('active');
                this.currentTool = btn.dataset.tool;
            });
        });
    }

    getPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) * (this.canvas.width / rect.width),
            y: (e.clientY - rect.top) * (this.canvas.height / rect.height)
        };
    }

    startDrawing(e) {
        if (this.currentTool === 'fill') {
            const pos = this.getPos(e);
            this.floodFill(Math.floor(pos.x), Math.floor(pos.y), this.brushColor);
            this.saveState();
            return;
        }
        
        this.isDrawing = true;
        this.ctx.beginPath();
        const pos = this.getPos(e);
        this.ctx.moveTo(pos.x, pos.y);
        this.saveState();
    }

    draw(e) {
        if (!this.isDrawing) return;
        
        const pos = this.getPos(e);
        
        if (this.currentTool === 'eraser') {
            // Ластик восстанавливает фон
            this.ctx.globalCompositeOperation = 'source-over';
            if (this.bgImage) {
                this.ctx.putImageData(this.bgImage, 0, 0);
            }
            this.ctx.strokeStyle = this.bgColor;
            this.ctx.lineWidth = this.brushSize * 2;
            this.ctx.lineCap = 'round';
            this.ctx.lineJoin = 'round';
            this.ctx.lineTo(pos.x, pos.y);
            this.ctx.stroke();
        } else if (this.currentTool === 'spray') {
            this.ctx.globalCompositeOperation = 'source-over';
            this.ctx.fillStyle = this.brushColor;
            this.sprayPaint(pos.x, pos.y);
            return;
        } else {
            this.ctx.globalCompositeOperation = 'source-over';
            this.ctx.strokeStyle = this.brushColor;
            this.ctx.lineWidth = this.brushSize;
            this.ctx.lineCap = 'round';
            this.ctx.lineJoin = 'round';
            this.ctx.lineTo(pos.x, pos.y);
            this.ctx.stroke();
        }
    }

    sprayPaint(x, y) {
        const density = 50;
        for (let i = 0; i < density; i++) {
            const offsetX = (Math.random() - 0.5) * this.brushSize * 2;
            const offsetY = (Math.random() - 0.5) * this.brushSize * 2;
            const radius = Math.random() * 2;
            
            this.ctx.beginPath();
            this.ctx.arc(x + offsetX, y + offsetY, radius, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }

    floodFill(startX, startY, fillColor) {
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        const data = imageData.data;
        const width = imageData.width;
        const height = imageData.height;
        
        const targetColor = this.getPixelColor(imageData, startX, startY);
        const fillColorRGB = this.hexToRgb(fillColor);
        
        if (this.colorsMatch(targetColor, fillColorRGB)) return;
        
        const stack = [[startX, startY]];
        const visited = new Set();
        
        while (stack.length > 0) {
            const [x, y] = stack.pop();
            const key = `${x},${y}`;
            
            if (x < 0 || x >= width || y < 0 || y >= height) continue;
            if (visited.has(key)) continue;
            
            const currentColor = this.getPixelColor(imageData, x, y);
            if (!this.colorsMatch(currentColor, targetColor)) continue;
            
            visited.add(key);
            this.setPixelColor(imageData, x, y, fillColorRGB);
            
            stack.push([x + 1, y]);
            stack.push([x - 1, y]);
            stack.push([x, y + 1]);
            stack.push([x, y - 1]);
        }
        
        this.ctx.putImageData(imageData, 0, 0);
    }

    getPixelColor(imageData, x, y) {
        const index = (y * imageData.width + x) * 4;
        return {
            r: imageData.data[index],
            g: imageData.data[index + 1],
            b: imageData.data[index + 2],
            a: imageData.data[index + 3]
        };
    }

    setPixelColor(imageData, x, y, color) {
        const index = (y * imageData.width + x) * 4;
        imageData.data[index] = color.r;
        imageData.data[index + 1] = color.g;
        imageData.data[index + 2] = color.b;
        imageData.data[index + 3] = 255;
    }

    colorsMatch(color1, color2) {
        return Math.abs(color1.r - color2.r) < 10 &&
               Math.abs(color1.g - color2.g) < 10 &&
               Math.abs(color1.b - color2.b) < 10;
    }

    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 0, g: 0, b: 0 };
    }

    stopDrawing() {
        this.isDrawing = false;
        this.ctx.globalCompositeOperation = 'source-over';
        // Сохраняем фон после рисования
        this.saveBgImage();
    }

    clear() {
        this.ctx.fillStyle = this.bgColor;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.saveBgImage();
        this.saveState();
    }

    changeBackground(color) {
        this.bgColor = color;
        // Сохраняем текущий рисунок
        const currentDrawing = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        // Заливаем новым фоном
        this.ctx.fillStyle = color;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        // Восстанавливаем рисунок поверх
        this.ctx.putImageData(currentDrawing, 0, 0);
        this.saveBgImage();
        this.saveState();
    }

    setBackground(color) {
        this.bgColor = color;
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = color;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.putImageData(imageData, 0, 0);
        this.saveBgImage();
        this.saveState();
    }

    saveState() {
        this.undoStack.push(this.canvas.toDataURL());
        if (this.undoStack.length > 50) {
            this.undoStack.shift();
        }
    }

    undo() {
        if (this.undoStack.length <= 1) return;
        this.undoStack.pop();
        const img = new Image();
        img.src = this.undoStack[this.undoStack.length - 1];
        img.onload = () => {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height);
            this.saveBgImage();
        };
    }

    getImage() {
        return this.canvas.toDataURL('image/png');
    }
}
