// Шифрование чувствительных данных перед отправкой
export class CryptoManager {
    constructor() {
        // Публичный ключ для шифрования (генерируется на сервере)
        this.publicKey = null;
    }
    
    async init() {
        // Получаем публичный ключ с сервера
        try {
            const response = await fetch('/api/public-key');
            const data = await response.json();
            this.publicKey = data.publicKey;
        } catch (error) {
            console.error('Failed to get public key:', error);
        }
    }
    
    // Генерация случайного ключа AES
    generateAESKey() {
        return crypto.subtle.generateKey(
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt']
        );
    }
    
    // Шифрование данных AES
    async encryptAES(data, key) {
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encoded = new TextEncoder().encode(JSON.stringify(data));
        
        const encrypted = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv },
            key,
            encoded
        );
        
        return {
            iv: Array.from(iv),
            data: Array.from(new Uint8Array(encrypted))
        };
    }
    
    // Шифрование AES ключа с помощью RSA публичного ключа
    async encryptRSA(aesKey, publicKeyPem) {
        const publicKey = await crypto.subtle.importKey(
            'spki',
            this.pemToArrayBuffer(publicKeyPem),
            { name: 'RSA-OAEP', hash: 'SHA-256' },
            false,
            ['encrypt']
        );
        
        const rawKey = await crypto.subtle.exportKey('raw', aesKey);
        
        const encrypted = await crypto.subtle.encrypt(
            { name: 'RSA-OAEP' },
            publicKey,
            rawKey
        );
        
        return Array.from(new Uint8Array(encrypted));
    }
    
    // Основная функция шифрования платёжных данных
    async encryptPaymentData(paymentData) {
        if (!this.publicKey) {
            await this.init();
        }
        
        // Генерируем AES ключ
        const aesKey = await this.generateAESKey();
        
        // Шифруем данные AES
        const encryptedData = await this.encryptAES(paymentData, aesKey);
        
        // Шифруем AES ключ RSA
        const encryptedKey = await this.encryptRSA(aesKey, this.publicKey);
        
        return {
            encryptedKey: encryptedKey,
            iv: encryptedData.iv,
            encryptedData: encryptedData.data
        };
    }
    
    // Хеширование SHA-256
    async hashData(data) {
        const encoded = new TextEncoder().encode(data);
        const hash = await crypto.subtle.digest('SHA-256', encoded);
        return Array.from(new Uint8Array(hash))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }
    
    pemToArrayBuffer(pem) {
        const b64 = pem
            .replace('-----BEGIN PUBLIC KEY-----', '')
            .replace('-----END PUBLIC KEY-----', '')
            .replace(/\s/g, '');
        const binary = atob(b64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
    }
}

export const cryptoManager = new CryptoManager();
