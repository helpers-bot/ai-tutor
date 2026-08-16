import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { LestaClient } from '@/lib/lesta/client'

export async function POST(request: Request) {
  const { challenge_id, user_id } = await request.json()
  
  // Get challenge
  const { data: challenge, error: challengeError } = await supabase
    .from('challenges')
    .select('*')
    .eq('id', challenge_id)
    .single()
  
  if (challengeError || !challenge) {
    return NextResponse.json({ error: 'Challenge not found' }, { status: 404 })
  }
  
  if (challenge.status !== 'active') {
    return NextResponse.json({ error: 'Challenge is not active' }, { status: 400 })
  }
  
  // Check if user already participating
  const { data: existingParticipation } = await supabase
    .from('participations')
    .select('*')
    .eq('challenge_id', challenge_id)
    .eq('user_id', user_id)
    .single()
  
  if (existingParticipation) {
    return NextResponse.json({ error: 'Already participating' }, { status: 400 })
  }
  
  // Get user
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('id', user_id)
    .single()
  
  if (userError || !user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }
  
  // Check balance for entry fee
  if (challenge.entry_fee > 0 && user.balance < challenge.entry_fee) {
    return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 })
  }
  
  // Get initial stats
  const lestaClient = new LestaClient(user.access_token)
  const currentStats = challenge.tank_id 
    ? await lestaClient.getTankStats(user.account_id, challenge.tank_id)
    : await lestaClient.getTankStats(user.account_id)
  
  let startBattles = 0
  let startValue = 0
  
  if (challenge.tank_id && currentStats.length > 0) {
    startBattles = currentStats[0].all.battles
    startValue = calculateTargetValue(currentStats[0], challenge.target_type)
  } else {
    currentStats.forEach(tank => {
      startBattles += tank.all.battles
      startValue += calculateTargetValue(tank, challenge.target_type)
    })
  }
  
  // Create participation
  const { data: participation, error: participationError } = await supabase
    .from('participations')
    .insert({
      challenge_id,
      user_id,
      start_battles: startBattles,
      start_value: startValue,
      start_stats: currentStats,
      status: 'in_progress'
    })
    .select()
    .single()
  
  if (participationError) {
    return NextResponse.json({ error: participationError.message }, { status: 500 })
  }
  
  // Deduct entry fee if any
  if (challenge.entry_fee > 0) {
    await supabase
      .from('transactions')
      .insert({
        user_id,
        challenge_id,
        participation_id: participation.id,
        amount: challenge.entry_fee,
        type: 'entry_fee',
        description: `Вступительный взнос за челлендж "${challenge.title}"`,
      })
  }
  
  return NextResponse.json(participation, { status: 201 })
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
