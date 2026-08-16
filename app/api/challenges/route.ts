import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') || 'active'
  const limit = parseInt(searchParams.get('limit') || '10')
  const offset = parseInt(searchParams.get('offset') || '0')
  
  const { data: challenges, error } = await supabase
    .from('challenges')
    .select(`
      *,
      creator:users(id, nickname, account_id),
      participations(count)
    `)
    .eq('status', status)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  
  return NextResponse.json(challenges)
}

export async function POST(request: Request) {
  const body = await request.json()
  
  const { data: challenge, error } = await supabase
    .from('challenges')
    .insert(body)
    .select()
    .single()
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  
  return NextResponse.json(challenge, { status: 201 })
}
