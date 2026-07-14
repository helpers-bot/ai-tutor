import { supabase } from './supabase.js';

export class AuthManager {
    constructor() {
        this.currentUser = supabase.getCurrentUser();
        this.mode = 'login';
    }
    
    render(container) {
        container.innerHTML = `
            <div class="auth-container">
                <h1>🎬 TikTok Clone</h1>
                <div class="auth-tabs">
                    <button class="${this.mode === 'login' ? 'active' : ''}" 
                            id="tabLogin">Вход</button>
                    <button class="${this.mode === 'register' ? 'active' : ''}" 
                            id="tabRegister">Регистрация</button>
                </div>
                
                <form class="auth-form" id="authForm">
                    <div class="form-group" id="usernameGroup" 
                         style="display:${this.mode === 'register' ? 'block' : 'none'}">
                        <label>Имя пользователя</label>
                        <input type="text" id="username" placeholder="Придумайте имя" minlength="3">
                    </div>
                    
                    <div class="form-group">
                        <label>Email</label>
                        <input type="email" id="email" placeholder="your@email.com" required>
                    </div>
                    
                    <div class="form-group">
                        <label>Пароль</label>
                        <input type="password" id="password" 
                               placeholder="Минимум 6 символов" 
                               minlength="6" required>
                    </div>
                    
                    <button type="submit" class="submit-btn" id="submitBtn">
                        ${this.mode === 'login' ? 'Войти' : 'Зарегистрироваться'}
                    </button>
                </form>
            </div>
        `;
        
        this.attachEvents(container);
    }
    
    attachEvents(container) {
        const tabLogin = container.querySelector('#tabLogin');
        const tabRegister = container.querySelector('#tabRegister');
        const form = container.querySelector('#authForm');
        
        tabLogin.addEventListener('click', () => {
            this.mode = 'login';
            this.render(container);
        });
        
        tabRegister.addEventListener('click', () => {
            this.mode = 'register';
            this.render(container);
        });
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleSubmit(form);
        });
    }
    
    async handleSubmit(form) {
        const email = form.querySelector('#email').value.trim();
        const password = form.querySelector('#password').value;
        const username = form.querySelector('#username')?.value?.trim();
        const submitBtn = form.querySelector('#submitBtn');
        
        if (!email || !password) {
            this.showError('Заполните все поля');
            return;
        }
        
        if (this.mode === 'register' && (!username || username.length < 3)) {
            this.showError('Имя пользователя должно содержать минимум 3 символа');
            return;
        }
        
        submitBtn.disabled = true;
        submitBtn.textContent = 'Подождите...';
        
        try {
            let result;
            
            if (this.mode === 'register') {
                result = await supabase.signUp(email, password, username);
            } else {
                result = await supabase.signIn(email, password);
            }
            
            if (result.user || result.access_token) {
                this.currentUser = result.user || supabase.getCurrentUser();
                // Вызываем колбэк успешной аутентификации
                if (this.onAuthSuccess) {
                    this.onAuthSuccess();
                }
            } else {
                throw new Error(result.error?.message || 'Ошибка аутентификации');
            }
        } catch (error) {
            this.showError(error.message);
            submitBtn.disabled = false;
            submitBtn.textContent = this.mode === 'login' ? 'Войти' : 'Зарегистрироваться';
        }
    }
    
    showError(message) {
        // Удаляем старое сообщение
        const oldError = document.querySelector('.error-message');
        if (oldError) oldError.remove();
        
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.style.cssText = `
            background: #ff000033;
            color: #ff4444;
            padding: 10px;
            border-radius: 8px;
            margin-top: 15px;
            text-align: center;
            font-size: 14px;
        `;
        errorDiv.textContent = message;
        
        const form = document.querySelector('#authForm');
        if (form) form.appendChild(errorDiv);
        
        setTimeout(() => errorDiv.remove(), 5000);
    }
    
    async logout() {
        await supabase.signOut();
        this.currentUser = null;
    }
    
    isLoggedIn() {
        return supabase.isAuthenticated() && this.currentUser;
    }
    
    getUser() {
        return this.currentUser || supabase.getCurrentUser();
    }
}
