'use client'

import { Button } from '@/components/ui/button'

export function LestaLoginButton() {
  const handleLogin = () => {
    window.location.href = '/api/auth/lesta/login'
  }
  
  return (
    <Button 
      onClick={handleLogin}
      className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
    >
      <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
      </svg>
      Войти через Lesta Games
    </Button>
  )
}
