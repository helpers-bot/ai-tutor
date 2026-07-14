import { CONFIG } from './config.js';
import { cryptoManager } from './crypto.js';

export class PaymentManager {
    constructor() {
        this.apiKey = CONFIG.nowpayments.apiKey;
        this.baseUrl = 'https://api.nowpayments.io/v1';
    }
    
    // Создание платежа за звезды
    async createStarsPayment(userId, packageData) {
        try {
            // Шифруем чувствительные данные
            const encryptedUserData = await cryptoManager.encryptPaymentData({
                userId: userId,
                timestamp: Date.now(),
                packageId: packageData.id
            });
            
            // Создаём платёж через NOWPayments
            const payment = await this.createInvoice({
                price_amount: packageData.price,
                price_currency: 'usd',
                pay_currency: 'btc',
                order_id: `stars_${userId}_${Date.now()}`,
                order_description: `Покупка ${packageData.stars} звезд`,
                ipn_callback_url: `${window.location.origin}/api/nowpayments-ipn`,
                success_url: `${window.location.origin}?payment=success&stars=${packageData.stars}`,
                cancel_url: `${window.location.origin}?payment=cancel`
            });
            
            // Сохраняем зашифрованные данные о платеже локально
            this.saveEncryptedPaymentInfo(payment.invoice_id, encryptedUserData, packageData);
            
            return {
                success: true,
                paymentUrl: payment.invoice_url,
                invoiceId: payment.invoice_id
            };
        } catch (error) {
            console.error('Payment creation failed:', error);
            return {
                success: false,
                error: 'Ошибка создания платежа'
            };
        }
    }
    
    async createInvoice(data) {
        const response = await fetch(`${this.baseUrl}/invoice`, {
            method: 'POST',
            headers: {
                'x-api-key': this.apiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Invoice creation failed');
        }
        
        return await response.json();
    }
    
    // Проверка статуса платежа
    async checkPaymentStatus(invoiceId) {
        try {
            const response = await fetch(`${this.baseUrl}/invoice/${invoiceId}`, {
                headers: {
                    'x-api-key': this.apiKey
                }
            });
            
            if (!response.ok) throw new Error('Status check failed');
            
            const data = await response.json();
            return {
                status: data.invoice_status,
                paid: data.invoice_status === 'confirmed' || data.invoice_status === 'paid'
            };
        } catch (error) {
            console.error('Status check failed:', error);
            return { status: 'error', paid: false };
        }
    }
    
    // Сохранение зашифрованной информации о платеже
    saveEncryptedPaymentInfo(invoiceId, encryptedData, packageData) {
        const paymentInfo = {
            invoiceId,
            encryptedData,
            packageData,
            timestamp: Date.now()
        };
        
        // Сохраняем в localStorage (уже зашифровано)
        const payments = JSON.parse(localStorage.getItem('pending_payments') || '[]');
        payments.push(paymentInfo);
        localStorage.setItem('pending_payments', JSON.stringify(payments));
    }
    
    // Получение ожидающих платежей
    getPendingPayments() {
        return JSON.parse(localStorage.getItem('pending_payments') || '[]');
    }
    
    // Удаление обработанного платежа
    removePendingPayment(invoiceId) {
        const payments = this.getPendingPayments();
        const filtered = payments.filter(p => p.invoiceId !== invoiceId);
        localStorage.setItem('pending_payments', JSON.stringify(filtered));
    }
    
    // Проверка платежей при загрузке страницы
    async checkPendingPayments(userId) {
        const urlParams = new URLSearchParams(window.location.search);
        const paymentResult = urlParams.get('payment');
        
        if (paymentResult === 'success') {
            const stars = parseInt(urlParams.get('stars') || '0');
            if (stars > 0) {
                // Зачисляем звезды через Supabase Edge Function
                await this.confirmStarsDelivery(userId, stars);
                
                // Очищаем URL
                window.history.replaceState({}, '', window.location.pathname);
            }
        }
        
        // Проверяем сохранённые платежи
        const pending = this.getPendingPayments();
        for (const payment of pending) {
            const status = await this.checkPaymentStatus(payment.invoiceId);
            if (status.paid) {
                await this.confirmStarsDelivery(userId, payment.packageData.stars);
                this.removePendingPayment(payment.invoiceId);
            }
        }
    }
    
    // Подтверждение доставки звёзд через серверную функцию
    async confirmStarsDelivery(userId, stars) {
        try {
            const response = await fetch('/api/deliver-stars', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userId: userId,
                    stars: stars,
                    // Добавляем подпись для верификации
                    signature: await cryptoManager.hashData(`${userId}_${stars}_${Date.now()}`)
                })
            });
            
            if (!response.ok) throw new Error('Delivery failed');
            
            return await response.json();
        } catch (error) {
            console.error('Stars delivery failed:', error);
            return { success: false };
        }
    }
}

export const paymentManager = new PaymentManager();
