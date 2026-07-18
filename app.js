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

    // Инициализация Google Sign-In
    function initializeGoogleSignIn() {
        if (window.google && window.google.accounts && window.google.accounts.id) {
            try {
                window.google.accounts.id.initialize({
                    client_id: GOOGLE_CLIENT_ID,
                    callback: handleGoogleSignIn,
                    auto_select: false,
                    context: 'signin'
                })
                
                window.google.accounts.id.renderButton(
                    document.getElementById('googleSignInButton'),
                    { 
                        theme: 'filled_black', 
                        size: 'large',
                        text: 'signin_with',
                        shape: 'pill',
                        width: 300
                    }
                )
                console.log('Google Sign-In initialized')
            } catch (error) {
                console.error('Google Sign-In initialization error:', error)
            }
        } else {
            console.log('Google library not loaded, retrying...')
            setTimeout(initializeGoogleSignIn, 1000)
        }
    }

    // Google Sign-In callback
    async function handleGoogleSignIn(response) {
        if (!response.credential) {
            console.error('No credential received')
            return
        }

        try {
            console.log('Signing in with Google...')
            const { data, error } = await supabase.auth.signInWithIdToken({
                provider: 'google',
                token: response.credential,
                nonce: ''
            })

            if (error) {
                console.error('Sign in error:', error)
                
                // Альтернативный метод входа
                const { data: data2, error: error2 } = await supabase.auth.signInWithOAuth({
                    provider: 'google',
                    options: {
                        redirectTo: window.location.origin,
                        queryParams: {
                            access_type: 'offline',
                            prompt: 'consent'
                        }
                    }
                })
                
                if (error2) {
                    throw error2
                }
                return
            }

            if (data.user) {
                currentUser = data.user
                console.log('User signed in:', currentUser.email)
                await loadUserData()
                showMiningScreen()
            }
        } catch (error) {
            console.error('Authentication error:', error)
            alert('Ошибка входа. Пожалуйста, попробуйте еще раз или проверьте подключение.')
        }
    }

    // Загрузка данных пользователя
    async function loadUserData() {
        try {
            console.log('Loading user data...')
            let { data: userData, error } = await supabase
                .from('users')
                .select('*')
                .eq('id', currentUser.id)
                .single()

            if (!userData) {
                console.log('Creating new user...')
                const { data: newUser, error: createError } = await supabase
                    .from('users')
                    .insert([{
                        id: currentUser.id,
                        email: currentUser.email,
                        nickname: currentUser.user_metadata?.full_name || 'Miner',
                        avatar_url: currentUser.user_metadata?.avatar_url || '',
                        balance: 0.0000000,
                        ads_enabled: false,
                        mining_speed: 0.0000001,
                        created_at: new Date().toISOString()
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
            document.getElementById('nicknameDisplay').textContent = userData.nickname || 'Miner'
            document.getElementById('profilePic').src = userData.avatar_url || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="%2300f3ff"/><text x="50" y="65" text-anchor="middle" font-size="40" fill="white" font-family="Arial">V</text></svg>'
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

            startMining()

        } catch (error) {
            console.error('Load user data error:', error)
        }
    }

    // Обновление никнейма
    window.updateNickname = async function() {
        const newNickname = document.getElementById('nicknameInput').value.trim()
        if (!newNickname || !currentUser) return

        try {
            const { error } = await supabase
                .from('users')
                .update({ nickname: newNickname })
                .eq('id', currentUser.id)

            if (error) throw error

            document.getElementById('nicknameDisplay').textContent = newNickname
            alert('✅ Никнейм обновлен!')
        } catch (error) {
            console.error('Update nickname error:', error)
            alert('❌ Ошибка обновления никнейма')
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

            if (error) throw error
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
    window.showSpeedModal = () => document.getElementById('speedModal').classList.add('active')
    window.showDisableModal = () => document.getElementById('disableModal').classList.add('active')
    window.closeModal = (id) => document.getElementById(id).classList.remove('active')

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
    }

    // Отключение рекламы
    window.disableAdsAndReload = async function() {
        isAdsEnabled = false
        miningSpeed = 0.0000001
        
        await updateBalanceInDB()
        hideAds()
        window.location.reload()
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
        
        await supabase.auth.signOut()
        currentUser = null
        document.getElementById('loginScreen').style.display = 'flex'
        document.getElementById('miningScreen').style.display = 'none'
        hideAds()
        
        if (window.google?.accounts?.id) {
            window.google.accounts.id.disableAutoSelect()
        }
    }

    // Закрытие модальных окон по клику
    window.onclick = function(event) {
        if (event.target.classList.contains('modal')) {
            event.target.classList.remove('active')
        }
    }

    // Проверка сессии при загрузке
    async function checkSession() {
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (session) {
                currentUser = session.user
                console.log('Session found:', currentUser.email)
                await loadUserData()
                showMiningScreen()
            }
        } catch (error) {
            console.error('Session check error:', error)
        }
    }

    // Слушатель изменений аутентификации
    function setupAuthListener() {
        supabase.auth.onAuthStateChange(async (event, session) => {
            console.log('Auth state changed:', event)
            if (event === 'SIGNED_IN' && session) {
                currentUser = session.user
                await loadUserData()
                showMiningScreen()
            } else if (event === 'SIGNED_OUT') {
                currentUser = null
                document.getElementById('loginScreen').style.display = 'flex'
                document.getElementById('miningScreen').style.display = 'none'
            }
        })
    }

    // Инициализация
    window.addEventListener('load', async () => {
        initSupabase()
        createParticles()
        initializeGoogleSignIn()
        setupAuthListener()
        
        // Задержка для загрузки Google библиотеки
        setTimeout(async () => {
            await checkSession()
        }, 2000)
    })

})()
