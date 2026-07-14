import { CONFIG } from './config.js';

const CLOUD_NAME = CONFIG.cloudinary.cloudName;
const UPLOAD_PRESET = CONFIG.cloudinary.uploadPreset;

export async function uploadToCloudinary(file) {
    return new Promise((resolve, reject) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', UPLOAD_PRESET);
        
        const uploadType = file.type.startsWith('video/') ? 'video' : 'image';
        
        const xhr = new XMLHttpRequest();
        
        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const percent = (e.loaded / e.total) * 100;
                window.dispatchEvent(
                    new CustomEvent('uploadProgress', { detail: percent })
                );
            }
        });
        
        xhr.addEventListener('load', () => {
            if (xhr.status === 200) {
                const response = JSON.parse(xhr.responseText);
                resolve(response.secure_url);
            } else {
                const error = JSON.parse(xhr.responseText);
                reject(new Error(error.error?.message || 'Upload failed'));
            }
        });
        
        xhr.addEventListener('error', () => {
            reject(new Error('Network error during upload'));
        });
        
        xhr.open(
            'POST',
            `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${uploadType}/upload`
        );
        xhr.send(formData);
    });
}

export function getVideoDuration(file) {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        
        video.onloadedmetadata = () => {
            window.URL.revokeObjectURL(video.src);
            resolve(video.duration);
        };
        
        video.onerror = () => {
            reject(new Error('Failed to load video'));
        };
        
        video.src = URL.createObjectURL(file);
    });
}

export function validateFile(file, maxDuration, maxSize) {
    const errors = [];
    
    if (file.size > maxSize) {
        errors.push(`Файл слишком большой. Максимальный размер: ${maxSize / 1024 / 1024}MB`);
    }
    
    const allowedTypes = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'video/mp4', 'video/webm', 'video/quicktime'
    ];
    
    if (!allowedTypes.includes(file.type)) {
        errors.push('Неподдерживаемый формат файла');
    }
    
    return {
        valid: errors.length === 0,
        errors
    };
}
