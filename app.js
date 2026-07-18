(function() {
    'use strict';

    // Supabase конфигурация
    const SUPABASE_URL = 'https://l2ls0oS3ZwF9GUTochw.supabase.co'
    const SUPABASE_ANON_KEY = 'sb_publishable_l2ls0oS3ZwF9GUTochw_NQ_FKV4rF6Y'
    const GOOGLE_CLIENT_ID = '12713380811-j7nrjdovklvm4m6rliklbm5g9chmc8j2.apps.googleusercontent.com'
    
    let supabase
    let currentUser = null
    let miningInterval = null
    let currentBalance = 0
    let isAdsEnabled = false
    let miningSpeed = 0.0000001
    let lastSaveTime = Date.now()

    // Инициализация Supabase
    function initSupabase() {
        try {
            supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
            console.log('Supabase initialized')
        } catch (error) {
            console.error('Supabase initialization error:', error)
        }
    }

    // Создание фоновых частиц
    function createParticles() {
        const container = document.getElementById('particles')
        if (!container) return
        
        const colors = ['#00f3ff', '#b347ea', '#ff6b9d', '#39ff14', '#ffff00']
        
        for (let i = 0; i < 50; i++) {
            const particle = document.createElement('div')
            particle.className = 'particle'
            
            const size = Math.random() * 4 + 2
            const color = colors[Math.floor(Math.random() * colors.length)]
            
            particle.style.width = `${size}px`
            particle.style.height = `${size}px`
            particle.style.left = `${Math.random() * 100}%`
            particle.style.top = `${Math.random() * 100}%`
            particle.style.background = color
            particle.style.animationDelay = `${Math.random() * 3}s`
            particle.style.animationDuration = `${Math.random() * 2 + 2}s`
            
            container.appendChild(particle)
        }
    }

    // Инициализация Google Sign-In (ТОЛЬКО POPUP, без редиректов)
    function initializeGoogleSignIn() {
        const buttonContainer = document.getElementById('googleSignInButton')
        if (!buttonContainer) {
            console.error('Button container not found')
            return
        }

        // Очищаем контейнер
        buttonContainer.innerHTML = ''

        // Создаем свою кнопку вместо Google кнопки
        const customButton = document.createElement('button')
        customButton.className = 'google-btn-custom'
        customButton.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Войти через Google
        `
        customButton.onclick = signInWithGoogle
        buttonContainer.appendChild(customButton)

        // Добавляем стили для кастомной кнопки
        const style = document.createElement('style')
        style.textContent = `
            .google-btn-custom {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 10px;
                width: 100%;
                max-width: 300px;
                padding: 12px 20px;
                background: white;
                border: 2px solid #ddd;
                border-radius: 50px;
                font-size: 16px;
                font-weight: 500;
                color: #333;
                cursor: pointer;
                transition: all 0.3s;
                margin: 0 auto;
            }
            .google-btn-custom:hover {
                background: #f5f5f5;
                border-color: #00f3ff;
                box-shadow: 0 0 20px rgba(0, 243, 255, 0.3);
                transform: translateY(-2px);
            }
            .google-btn-custom svg {
                width: 24px;
                height: 24px;
            }
        `
        document.head.appendChild(style)
    }

    // Вход через Google POPUP (не редирект)
    async function signInWithGoogle() {
        try {
            console.log('Starting Google Sign-In...')
            
            // Используем popup вместо redirect
            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: window.location.origin + window.location.pathname,
                    queryParams: {
                        prompt: 'select_account'
                    }
                }
            })

            if (error) {
                console.error('Sign in error:', error)
                
                // Если popup заблокирован, пробуем другой метод
                if (error.message.includes('popup')) {
                    alert('Пожалуйста, разрешите всплывающие окна для этого сайта')
                } else {
                    alert('Ошибка входа: ' + error.message)
                }
            }
        } catch (error) {
            console.error('Authentication error:', error)
            alert('Ошибка входа. Проверьте подключение к интернету.')
        }
    }

    // Обработка возврата после OAuth редиректа
    async function handleOAuthCallback() {
        const urlParams = new URLSearchParams(window.location.search)
        const code = urlParams.get('code')
        
        if (code) {
            console.log('OAuth callback detected')
            try {
                const { data, error } = await supabase.auth.exchangeCodeForSession(code)
                if (error) throw error
                
                if (data.session) {
                    currentUser = data.session.user
                    console.log('User authenticated:', currentUser.email)
                    await loadUserData()
                    showMiningScreen()
                    
                    // Очищаем URL от параметров
                    window.history.replaceState({}, document.title, window.location.pathname)
                }
            } catch (error) {
                console.error('OAuth callback error:', error)
            }
        }
    }

    // Загрузка данных пользователя
    async function loadUserData() {
        if (!currentUser) {
            console.error('No current user')
            return
        }

        try {
            console.log('Loading user data for:', currentUser.email)
            
            let { data: userData, error } = await supabase
                .from('users')
                .select('*')
                .eq('id', currentUser.id)
                .single()

            if (error && error.code !== 'PGRST116') {
                console.error('Load user error:', error)
                throw error
            }

            if (!userData) {
                console.log('Creating new user record...')
                const { data: newUser, error: createError } = await supabase
                    .from('users')
                    .insert([{
                        id: currentUser.id,
                        email: currentUser.email,
                        nickname: currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || 'Miner',
                        avatar_url: currentUser.user_metadata?.avatar_url || '',
                        balance: 0.0000000,
                        ads_enabled: false,
                        mining_speed: 0.0000001,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    }])
                    .select()
                    .single()

                if (createError) {
                    console.error('Create user error:', createError)
                    throw createError
                }
                userData = newUser
            }

            // Обновляем интерфейс
            updateUI(userData)
            
            // Запускаем майнинг
            startMining()

        } catch (error) {
            console.error('Load user data error:', error)
            // Если ошибка, все равно показываем интерфейс с базовыми значениями
            updateUI({
                nickname: currentUser.email?.split('@')[0] || 'Miner',
                avatar_url: '',
                balance: 0,
                ads_enabled: false,
                mining_speed: 0.0000001
            })
            startMining()
        }
    }

    // Обновление интерфейса
    function updateUI(userData) {
        document.getElementById('nicknameDisplay').textContent = userData.nickname || 'Miner'
        document.getElementById('profilePic').src = userData.avatar_url || `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#00f3ff"/><stop offset="100%" style="stop-color:#b347ea"/></linearGradient></defs><circle cx="50" cy="50" r="50" fill="url(#g)"/><text x="50" y="65" text-anchor="middle" font-size="45" fill="white" font-family="Arial Black" font-weight="bold">V</text></svg>')}`
        document.getElementById('nicknameInput').value = userData.nickname || ''
        
        currentBalance = userData.balance || 0
        isAdsEnabled = userData.ads_enabled || false
        miningSpeed = userData.mining_speed || 0.0000001

        updateBalanceDisplay()
        updateMiningSpeedDisplay()
        
        if (isAdsEnabled) {
            showAds()
            document.getElementById('speedBtn').style.display = 'none'
            document.getElementById('disableBtn').style.display = 'block'
        } else {
            hideAds()
            document.getElementById('speedBtn').style.display = 'block'
            document.getElementById('disableBtn').style.display = 'none'
        }
    }

    // Обновление никнейма
    window.updateNickname = async function() {
        const newNickname = document.getElementById('nicknameInput').value.trim()
        if (!newNickname || !currentUser) {
            alert('Введите никнейм')
            return
        }

        try {
            const { error } = await supabase
                .from('users')
                .update({ 
                    nickname: newNickname,
                    updated_at: new Date().toISOString()
                })
                .eq('id', currentUser.id)

            if (error) throw error

            document.getElementById('nicknameDisplay').textContent = newNickname
            showNotification('Никнейм обновлен!', 'success')
        } catch (error) {
            console.error('Update nickname error:', error)
            showNotification('Ошибка обновления', 'error')
        }
    }

    // Сохранение баланса
    async function updateBalanceInDB() {
        if (!currentUser) return
        
        try {
            const { error } = await supabase
                .from('users')
                .update({ 
                    balance: currentBalance,
                    ads_enabled: isAdsEnabled,
                    mining_speed: miningSpeed,
                    updated_at: new Date().toISOString()
                })
                .eq('id', currentUser.id)

            if (error) console.error('Save balance error:', error)
            lastSaveTime = Date.now()
        } catch (error) {
            console.error('Save balance error:', error)
        }
    }

    // Запуск майнинга
    function startMining() {
        if (miningInterval) clearInterval(miningInterval)
        
        miningInterval = setInterval(() => {
            currentBalance += miningSpeed
            updateBalanceDisplay()
            
            // Сохраняем каждые 10 секунд
            if (Date.now() - lastSaveTime > 10000) {
                updateBalanceInDB()
            }
        }, 1000)
    }

    // Обновление баланса на экране
    function updateBalanceDisplay() {
        const element = document.getElementById('balance')
        if (element) {
            element.textContent = currentBalance.toFixed(7)
        }
    }

    // Обновление скорости на экране
    function updateMiningSpeedDisplay() {
        const element = document.getElementById('miningSpeed')
        if (element) {
            element.textContent = miningSpeed.toFixed(7)
        }
    }

    // Модальные окна
    window.showSpeedModal = () => document.getElementById('speedModal')?.classList.add('active')
    window.showDisableModal = () => document.getElementById('disableModal')?.classList.add('active')
    window.closeModal = (id) => document.getElementById(id)?.classList.remove('active')

    // Включение рекламы
    window.enableAds = async function() {
        isAdsEnabled = true
        miningSpeed = 0.0000005
        
        showAds()
        updateMiningSpeedDisplay()
        
        document.getElementById('speedBtn').style.display = 'none'
        document.getElementById('disableBtn').style.display = 'block'
        
        await updateBalanceInDB()
        window.closeModal('speedModal')
        startMining()
        showNotification('Скорость увеличена в 5 раз!', 'success')
    }

    // Отключение рекламы
    window.disableAdsAndReload = async function() {
        isAdsEnabled = false
        miningSpeed = 0.0000001
        
        await updateBalanceInDB()
        hideAds()
        showNotification('Реклама отключена. Перезагрузка...', 'info')
        setTimeout(() => window.location.reload(), 1500)
    }

    // Управление рекламой
    function showAds() {
        const container = document.getElementById('adContainer')
        if (container) container.style.display = 'block'
    }

    function hideAds() {
        const container = document.getElementById('adContainer')
        if (container) container.style.display = 'none'
    }

    // Показать экран майнинга
    function showMiningScreen() {
        document.getElementById('loginScreen').style.display = 'none'
        document.getElementById('miningScreen').style.display = 'block'
    }

    // Выход
    window.logout = async function() {
        if (miningInterval) clearInterval(miningInterval)
        await updateBalanceInDB()
        
        const { error } = await supabase.auth.signOut()
        if (!error) {
            currentUser = null
            document.getElementById('loginScreen').style.display = 'flex'
            document.getElementById('miningScreen').style.display = 'none'
            hideAds()
        }
    }

    // Уведомления
    function showNotification(message, type = 'info') {
        const notification = document.createElement('div')
        notification.className = `notification notification-${type}`
        notification.textContent = message
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 25px;
            background: ${type === 'success' ? '#39ff14' : type === 'error' ? '#ff6b6b' : '#00f3ff'};
            color: #0a0a0f;
            border-radius: 10px;
            font-weight: bold;
            z-index: 10000;
            animation: slideInRight 0.5s ease;
            box-shadow: 0 5px 20px rgba(0,0,0,0.3);
        `
        document.body.appendChild(notification)
        
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.5s ease'
            setTimeout(() => notification.remove(), 500)
        }, 3000)
    }

    // Закрытие модальных окон по клику
    window.onclick = function(event) {
        if (event.target.classList.contains('modal')) {
            event.target.classList.remove('active')
        }
    }

    // Слушатель изменений аутентификации
    function setupAuthListener() {
        supabase.auth.onAuthStateChange((event, session) => {
            console.log('Auth state changed:', event)
            if (event === 'SIGNED_IN' && session) {
                currentUser = session.user
                loadUserData()
                showMiningScreen()
            } else if (event === 'SIGNED_OUT') {
                currentUser = null
                document.getElementById('loginScreen').style.display = 'flex'
                document.getElementById('miningScreen').style.display = 'none'
                if (miningInterval) clearInterval(miningInterval)
            }
        })
    }

    // Добавляем стили для анимаций уведомлений
    const notificationStyles = document.createElement('style')
    notificationStyles.textContent = `
        @keyframes slideInRight {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        @keyframes slideOutRight {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
    `
    document.head.appendChild(notificationStyles)

    // Инициализация
    window.addEventListener('load', async () => {
        console.log('App initializing...')
        initSupabase()
        createParticles()
        initializeGoogleSignIn()
        setupAuthListener()
        
        // Проверяем OAuth колбэк
        await handleOAuthCallback()
        
        // Проверяем существующую сессию
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
            console.log('Existing session found')
            currentUser = session.user
            await loadUserData()
            showMiningScreen()
        }
    })

})()
