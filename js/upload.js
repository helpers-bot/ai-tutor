import { uploadToCloudinary, getVideoDuration, validateFile } from './cloudinary.js';
import { supabase } from './supabase.js';
import { CONFIG } from './config.js';

export class UploadManager {
    constructor() {
        this.selectedFile = null;
        this.selectedDuration = 0;
    }
    
    render(container) {
        container.innerHTML = `
            <div class="upload-container">
                <h2>📤 Загрузить контент</h2>
                
                <div class="upload-form">
                    <div class="file-upload-area" id="fileArea">
                        <input type="file" id="fileInput" accept="image/*,video/*">
                        <div class="upload-icon">📁</div>
                        <h3>Выберите файл</h3>
                        <p style="color:#888">Фото или видео до ${CONFIG.content.maxVideoDuration} секунд</p>
                    </div>
                    
                    <div class="preview-container" id="preview"></div>
                    
                    <div class="form-group">
                        <textarea id="description" placeholder="Добавьте описание..."></textarea>
                    </div>
                    
                    <div class="premium-settings">
                        <label class="checkbox-group">
                            <input type="checkbox" id="isPremium">
                            <span>Сделать контент закрытым (Premium)</span>
                        </label>
                        
                        <div class="price-input" id="priceSettings">
                            <label>Цена в звездах ⭐</label>
                            <input type="number" id="priceStars" min="1" max="10000" value="10">
                        </div>
                    </div>
                    
                    <div style="display:flex;gap:10px">
                        <button class="btn btn-primary submit-btn" id="btnUpload" style="flex:1">
                            Загрузить
                        </button>
                        <button class="btn btn-secondary" id="btnCancel">
                            Отмена
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        this.attachEvents(container);
    }
    
    attachEvents(container) {
        const fileArea = container.querySelector('#fileArea');
        const fileInput = container.querySelector('#fileInput');
        const isPremium = container.querySelector('#isPremium');
        const priceSettings = container.querySelector('#priceSettings');
        const btnUpload = container.querySelector('#btnUpload');
        const btnCancel = container.querySelector('#btnCancel');
        
        fileArea.addEventListener('click', () => fileInput.click());
        
        fileInput.addEventListener('change', (e) => {
            this.handleFileSelect(e.target.files[0]);
        });
        
        isPremium.addEventListener('change', () => {
            priceSettings.classList.toggle('active', isPremium.checked);
        });
        
        btnUpload.addEventListener('click', () => this.upload());
        btnCancel.addEventListener('click', () => {
            if (this.onCancel) this.onCancel();
        });
        
        // Drag & drop
        fileArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            fileArea.style.borderColor = '#ff0050';
        });
        
        fileArea.addEventListener('dragleave', () => {
            fileArea.style.borderColor = '#333';
        });
        
        fileArea.addEventListener('drop', (e) => {
            e.preventDefault();
            fileArea.style.borderColor = '#333';
            const file = e.dataTransfer.files[0];
            if (file) this.handleFileSelect(file);
        });
    }
    
    async handleFileSelect(file) {
        if (!file) return;
        
        const validation = validateFile(
            file,
            CONFIG.content.maxVideoDuration,
            CONFIG.content.maxFileSize
        );
        
        if (!validation.valid) {
            alert(validation.errors.join('\n'));
            return;
        }
        
        this.selectedFile = file;
        this.selectedDuration = 0;
        
        const preview = document.getElementById('preview');
        preview.className = 'preview-container active';
        
        // Превью
        const reader = new FileReader();
        reader.onload = (e) => {
            if (file.type.startsWith('video/')) {
                preview.innerHTML = `
                    <video src="${e.target.result}" controls></video>
                    <p style="color:#888;margin-top:10px">Проверка длительности...</p>
                `;
                
                getVideoDuration(file).then(duration => {
                    this.selectedDuration = duration;
                    if (duration > CONFIG.content.maxVideoDuration) {
                        alert(`Видео должно быть не длиннее ${CONFIG.content.maxVideoDuration} секунд!`);
                        this.selectedFile = null;
                        preview.className = 'preview-container';
                        preview.innerHTML = '';
                    } else {
                        preview.querySelector('p').innerHTML = 
                            `✅ Длительность: ${Math.round(duration)}с`;
                    }
                });
            } else {
                preview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
            }
        };
        reader.readAsDataURL(file);
    }
    
    async upload() {
        if (!this.selectedFile) {
            alert('Выберите файл для загрузки');
            return;
        }
        
        const user = JSON.parse(localStorage.getItem('user'));
        if (!user) {
            alert('Вы не авторизованы');
            return;
        }
        
        const description = document.getElementById('description').value.trim();
        const isPremium = document.getElementById('isPremium').checked;
        const priceStars = parseInt(document.getElementById('priceStars').value) || 10;
        const btnUpload = document.getElementById('btnUpload');
        
        btnUpload.disabled = true;
        btnUpload.textContent = 'Загрузка...';
        
        try {
            // Загружаем в Cloudinary
            const mediaUrl = await uploadToCloudinary(this.selectedFile);
            
            // Сохраняем в Supabase
            await supabase.createContent({
                user_id: user.id,
                media_url: mediaUrl,
                media_type: this.selectedFile.type.startsWith('video/') ? 'video' : 'photo',
                description,
                is_premium: isPremium,
                price_stars: isPremium ? priceStars : 0,
                created_at: new Date().toISOString()
            });
            
            alert('✅ Контент успешно загружен!');
            if (this.onSuccess) this.onSuccess();
            
        } catch (error) {
            console.error('Upload error:', error);
            alert('❌ Ошибка загрузки: ' + error.message);
            btnUpload.disabled = false;
            btnUpload.textContent = 'Загрузить';
        }
    }
}
