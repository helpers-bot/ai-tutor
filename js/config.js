// ТОЛЬКО ПУБЛИЧНЫЕ ДАННЫЕ! Никаких секретов!
export const CONFIG = {
    appName: 'TikTok Clone',
    version: '1.0.0',
    
    supabase: {
        url: 'https://l2ls0oS3ZwF9GUTochw_NQ.supabase.co',
        publishableKey: 'sb_publishable_l2ls0oS3ZwF9GUTochw_NQ_FKV4rF6Y'
    },
    
    cloudinary: {
        cloudName: 'ЗАМЕНИТЕ_НА_ВАШ_CLOUD_NAME',
        uploadPreset: 'vds_upload'
    },
    
    nowpayments: {
        // Публичный API ключ NOWPayments (можно показывать)
        apiKey: 'ЗАМЕНИТЕ_НА_ВАШ_NOWPAYMENTS_API_KEY',
        // IPN Secret хранится ТОЛЬКО на сервере!
        ipnSecretUrl: '/api/nowpayments-ipn' // URL вашего серверного обработчика
    },
    
    content: {
        maxVideoDuration: 15,
        maxFileSize: 100 * 1024 * 1024
    }
};
