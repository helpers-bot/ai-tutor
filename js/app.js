import { AuthManager } from './auth.js';
import { FeedManager } from './feed.js';
import { UploadManager } from './upload.js';
import { PaymentManager } from './payments.js';
import { supabase } from './supabase.js';

class App {
    constructor() {
        this.auth = new AuthManager();
        this.feed = new FeedManager();
        this.upload = new UploadManager();
        this.payments = new PaymentManager();
        
        this.container = document.getElementById('app');
        
        // Привязываем колбэки
        this.auth.onAuthSuccess = () => this.showFeed();
        this.feed.onUpload = () => this.showUpload();
        this.feed.onBuyStars = () => this.showStarsShop();
        this.feed.onLogout = () => this.logout();
        this.feed.onUnlock = (id, price) => this.unlockContent(id, price);
        this.feed.onComment = (id) => this.showComments(id);
        this.upload.onCancel = () => this.showFeed();
        this.upload.onSuccess = () => this.showFeed();
        
        this.init();
    }
    
    async init() {
        if (supabase.isAuthenticated()) {
            // Проверяем pending payments
            const user = supabase.getCurrentUser();
            if (user) {
                await this.payments.checkPendingPayments(user.id);
            }
            await this.showFeed();
        } else {
            this.showAuth();
        }
    }
    
    showAuth() {
        this.auth.render(this.container);
    }
    
    async showFeed() {
        const user = supabase.getCurrentUser();
        if (!user) {
            this.showAuth();
            return;
        }
        await this.feed.render(this.container, user);
    }
    
    showUpload() {
        this.upload.render(this.container);
    }
    
    showStarsShop() {
        const packages = [
            { id: 1, stars: 50, price: 49, popular: false },
            { id: 2, stars: 150, price: 129, popular: true },
            { id: 3, stars: 500, price: 399, popular: false },
            { id: 4, stars: 1200, price: 899, popular: false }
        ];
        
        let html = `
            <div class="modal active" id="starsModal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>⭐ Купить звёзды</h3>
                        <button class="close-btn" id="closeStars">✕</button>
                    </div>
                    <div class="shop-grid">
        `;
        
        packages.forEach(pkg => {
            html += `
                <div class="star-package ${pkg.popular ? 'popular' : ''}" 
                     data-stars="${pkg.stars}" data-price="${pkg.price}">
                    ${pkg.popular ? '<div class="popular-badge">Популярный</div>' : ''}
                    <div class="star-amount">⭐ ${pkg.stars}</div>
                    <div class="star-price">$${pkg.price}</div>
                </div>
            `;
        });
        
        html += `
                    </div>
                    <div class="payment-info">
                        <p>🔒 Оплата через NOWPayments (BTC, ETH, USDT)</p>
                        <p>⚡ Звёзды начисляются автоматически после подтверждения</p>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', html);
        
        // Обработчики
        document.getElementById('closeStars').addEventListener('click', () => {
            document.getElementById('starsModal').remove();
        });
        
        document.getElementById('starsModal').addEventListener('click', (e) => {
            if (e.target.id === 'starsModal') {
                document.getElementById('starsModal').remove();
            }
        });
        
        document.querySelectorAll('.star-package').forEach(pkg => {
            pkg.addEventListener('click', async () => {
                const stars = parseInt(pkg.dataset.stars);
                const price = parseInt(pkg.dataset.price);
                await this.buyStars(stars, price);
            });
        });
    }
    
    async buyStars(stars, price) {
        const user = supabase.getCurrentUser();
        if (!user) {
            alert('Авторизуйтесь для покупки');
            return;
        }
        
        const modal = document.getElementById('starsModal');
        if (modal) modal.remove();
        
        // Показываем загрузку
        const loadingToast = document.createElement('div');
        loadingToast.className = 'toast';
        loadingToast.textContent = '⏳ Создаём платёж...';
        document.body.appendChild(loadingToast);
        
        try {
            const result = await this.payments.createStarsPayment(user.id, {
                id: Date.now(),
                stars,
                price
            });
            
            loadingToast.remove();
            
            if (result.success && result.paymentUrl) {
                // Открываем страницу оплаты в новой вкладке
                window.open(result.paymentUrl, '_blank');
                
                // Показываем уведомление
                const toast = document.createElement('div');
                toast.className = 'toast';
                toast.textContent = '✅ После оплаты звёзды начислятся автоматически. Обновите страницу.';
                document.body.appendChild(toast);
                setTimeout(() => toast.remove(), 5000);
            } else {
                alert('❌ Ошибка создания платежа: ' + (result.error || 'Попробуйте позже'));
            }
        } catch (error) {
            loadingToast.remove();
            alert('❌ Ошибка: ' + error.message);
        }
    }
    
    async unlockContent(contentId, price) {
        const user = supabase.getCurrentUser();
        if (!user) {
            alert('Авторизуйтесь для разблокировки');
            return;
        }
        
        if (!confirm(`Разблокировать контент за ${price} ⭐?`)) return;
        
        const balance = await supabase.getUserBalance(user.id);
        
        if (balance < price) {
            alert(`Недостаточно звёзд! У вас: ${balance} ⭐, нужно: ${price} ⭐`);
            this.showStarsShop();
            return;
        }
        
        try {
            await supabase.buyContent(user.id, contentId, price);
            alert('✅ Контент разблокирован!');
            await this.showFeed();
        } catch (error) {
            alert('❌ Ошибка при разблокировке');
        }
    }
    
    async showComments(contentId) {
        const user = supabase.getCurrentUser();
        if (!user) return;
        
        const comments = await supabase.getComments(contentId);
        
        let html = `
            <div class="modal active" id="commentsModal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>💬 Комментарии</h3>
                        <button class="close-btn" id="closeComments">✕</button>
                    </div>
        `;
        
        if (comments.length === 0) {
            html += '<p style="color:#888;text-align:center;padding:20px">Пока нет комментариев</p>';
        } else {
            comments.forEach(c => {
                html += `
                    <div class="comment">
                        <div class="comment-user">@${c.users?.username || 'user'}</div>
                        <div class="comment-text">${c.text}</div>
                    </div>
                `;
            });
        }
        
        html += `
                    <div class="comment-input-group">
                        <input type="text" id="commentInput" placeholder="Написать...">
                        <button class="btn btn-primary" id="btnSendComment">Отправить</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', html);
        
        document.getElementById('closeComments').addEventListener('click', () => {
            document.getElementById('commentsModal').remove();
        });
        
        document.getElementById('commentsModal').addEventListener('click', (e) => {
            if (e.target.id === 'commentsModal') {
                document.getElementById('commentsModal').remove();
            }
        });
        
        document.getElementById('btnSendComment').addEventListener('click', async () => {
            const input = document.getElementById('commentInput');
            const text = input.value.trim();
            if (!text) return;
            
            await supabase.addComment(user.id, contentId, text);
            document.getElementById('commentsModal').remove();
            this.showComments(contentId);
        });
    }
    
    async logout() {
        await this.auth.logout();
        this.showAuth();
    }
}

// Запуск приложения
const app = new App();
