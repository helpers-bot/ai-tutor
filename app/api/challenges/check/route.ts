import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { LestaClient } from '@/lib/lesta/client'

export async function POST(request: Request) {
  const { participation_id } = await request.json()
  
  // Get participation data
  const { data: participation, error: participationError } = await supabase
    .from('participations')
    .select(`
      *,
      challenge:challenges(*),
      user:users(*)
    `)
    .eq('id', participation_id)
    .single()
  
  if (participationError || !participation) {
    return NextResponse.json({ error: 'Participation not found' }, { status: 404 })
  }
  
  if (participation.status !== 'in_progress') {
    return NextResponse.json({ 
      status: participation.status,
      message: 'Participation already completed'
    })
  }
  
  const { challenge, user } = participation
  
  // Get current stats from Lesta API
  const lestaClient = new LestaClient(user.access_token)
  
  let currentStats
  if (challenge.tank_id) {
    currentStats = await lestaClient.getTankStats(user.account_id, challenge.tank_id)
  } else {
    currentStats = await lestaClient.getTankStats(user.account_id)
  }
  
  // Calculate total stats
  let currentBattles = 0
  let currentValue = 0
  
  if (challenge.tank_id && currentStats.length > 0) {
    currentBattles = currentStats[0].all.battles
    currentValue = calculateTargetValue(currentStats[0], challenge.target_type)
  } else {
    // Sum all tanks stats
    currentStats.forEach(tank => {
      currentBattles += tank.all.battles
      currentValue += calculateTargetValue(tank, challenge.target_type)
    })
  }
  
  const battlesPlayed = currentBattles - participation.start_battles
  const valueGained = currentValue - participation.start_value
  
  // Update participation progress
  const progressPercentage = Math.min(
    (valueGained / challenge.target_value) * 100,
    100
  )
  
  await supabase
    .from('participations')
    .update({
      current_battles: currentBattles,
      current_value: currentValue,
      progress_percentage: progressPercentage,
      updated_at: new Date().toISOString()
    })
    .eq('id', participation_id)
  
  // Check if challenge completed
  if (battlesPlayed >= challenge.battles_limit) {
    if (valueGained >= challenge.target_value) {
      // Success!
      const prizeAmount = challenge.prize_pool
      const platformFee = prizeAmount * 0.10 // 10% commission
      const userPrize = prizeAmount - platformFee
      
      // Update participation
      await supabase
        .from('participations')
        .update({
          status: 'success',
          prize_earned: userPrize,
          completed_at: new Date().toISOString()
        })
        .eq('id', participation_id)
      
      // Create prize transaction
      await supabase
        .from('transactions')
        .insert({
          user_id: user.id,
          challenge_id: challenge.id,
          participation_id: participation.id,
          amount: userPrize,
          type: 'prize',
          description: `Приз за челлендж "${challenge.title}"`,
          metadata: {
            challenge_title: challenge.title,
            target_value: challenge.target_value,
            actual_value: valueGained
          }
        })
      
      // Create fee transaction
      await supabase
        .from('transactions')
        .insert({
          user_id: user.id,
          challenge_id: challenge.id,
          participation_id: participation.id,
          amount: platformFee,
          type: 'fee',
          description: `Комиссия платформы за челлендж "${challenge.title}"`,
        })
      
      // Update user stats
      await supabase
        .from('users')
        .update({
          total_earned: user.total_earned + userPrize,
          challenges_completed: user.challenges_completed + 1
        })
        .eq('id', user.id)
      
      return NextResponse.json({
        status: 'success',
        prize: userPrize,
        progress: progressPercentage,
        battles_played: battlesPlayed,
        value_gained: valueGained
      })
    } else {
      // Failed
      await supabase
        .from('participations')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString()
        })
        .eq('id', participation_id)
      
      return NextResponse.json({
        status: 'failed',
        progress: progressPercentage,
        battles_played: battlesPlayed,
        value_gained: valueGained,
        target_value: challenge.target_value
      })
    }
  }
  
  return NextResponse.json({
    status: 'in_progress',
    progress: progressPercentage,
    battles_played: battlesPlayed,
    battles_remaining: challenge.battles_limit - battlesPlayed,
    value_gained: valueGained,
    target_value: challenge.target_value
  })
}

function calculateTargetValue(stats: any, targetType: string): number {
  switch (targetType) {
    case 'damage':
      return stats.all.damage_dealt || 0
    case 'frags':
      return stats.all.frags || 0
    case 'xp':
      return stats.all.xp || 0
    case 'wins':
      return stats.all.wins || 0
    default:
      return 0
  }
}
