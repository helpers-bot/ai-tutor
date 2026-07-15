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
        this.init();
    }

    init() {
        this.canvas = document.getElementById('drawCanvas');
        if (!this.canvas) return;
        
        this.ctx = this.canvas.getContext('2d');
        
        // Установка размера canvas
        this.canvas.width = Math.min(window.innerWidth, 600);
        this.canvas.height = Math.min(window.innerHeight - 200, 600);
        
        // Заливаем фон
        this.ctx.fillStyle = this.bgColor;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
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
            this.setBackground(e.target.value);
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
            this.ctx.globalCompositeOperation = 'destination-out';
            this.ctx.strokeStyle = 'rgba(0,0,0,1)';
        } else if (this.currentTool === 'spray') {
            this.ctx.globalCompositeOperation = 'source-over';
            this.ctx.fillStyle = this.brushColor;
            this.sprayPaint(pos.x, pos.y);
            return;
        } else {
            this.ctx.globalCompositeOperation = 'source-over';
            this.ctx.strokeStyle = this.brushColor;
        }
        
        this.ctx.lineWidth = this.brushSize;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        
        this.ctx.lineTo(pos.x, pos.y);
        this.ctx.stroke();
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

    stopDrawing() {
        this.isDrawing = false;
        this.ctx.globalCompositeOperation = 'source-over';
    }

    clear() {
        this.ctx.fillStyle = this.bgColor;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.saveState();
    }

    setBackground(color) {
        this.bgColor = color;
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = color;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.putImageData(imageData, 0, 0);
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
        };
    }

    getImage() {
        return this.canvas.toDataURL('image/png');
    }
}
