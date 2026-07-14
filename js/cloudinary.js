import { CONFIG } from './config.js';

export function uploadToCloudinary(file) {
    return new Promise((resolve, reject) => {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('upload_preset', CONFIG.cloudinary.uploadPreset);
        const type = file.type.startsWith('video/') ? 'video' : 'image';
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `https://api.cloudinary.com/v1_1/${CONFIG.cloudinary.cloudName}/${type}/upload`);
        xhr.onload = () => {
            if (xhr.status === 200) resolve(JSON.parse(xhr.responseText).secure_url);
            else reject(new Error('Upload failed'));
        };
        xhr.onerror = () => reject(new Error('Network error'));
        xhr.send(fd);
    });
}

export function getVideoDuration(file) {
    return new Promise((resolve) => {
        const v = document.createElement('video');
        v.preload = 'metadata';
        v.onloadedmetadata = () => { URL.revokeObjectURL(v.src); resolve(v.duration); };
        v.src = URL.createObjectURL(file);
    });
}
