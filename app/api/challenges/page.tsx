'use client'

import { useEffect, useState } from 'react'
import { ChallengeList } from '@/components/challenges/ChallengeList'
import { supabase } from '@/lib/supabase/client'

export default function ChallengesPage() {
  const [challenges, setChallenges] = useState([])
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    fetchChallenges()
  }, [])
  
  const fetchChallenges = async () => {
    const { data, error } = await supabase
      .from('challenges')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
    
    if (data) {
      setChallenges(data)
    }
    setLoading(false)
  }
  
  const handleParticipate = async (challengeId: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      window.location.href = '/api/auth/lesta/login'
      return
    }
    
    const response = await fetch('/api/challenges/participate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        challenge_id: challengeId,
        user_id: user.id
      })
    })
    
    if (response.ok) {
      alert('Вы успешно присоединились к челленджу!')
    }
  }
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Активные челленджи</h1>
      {loading ? (
        <div>Загрузка...</div>
      ) : (
        <ChallengeList 
          challenges={challenges} 
          onParticipate={handleParticipate}
        />
      )}
    </div>
  )
}
