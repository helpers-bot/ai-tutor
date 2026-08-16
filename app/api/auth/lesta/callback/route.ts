import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const accountId = searchParams.get('account_id')
  const nickname = searchParams.get('nickname')
  const accessToken = searchParams.get('access_token')
  const expiresAt = searchParams.get('expires_at')
  
  if (status !== 'ok' || !accountId || !nickname || !accessToken) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/?error=auth_failed`)
  }
  
  // Create or update user
  const { data: existingUser, error: userError } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('account_id', parseInt(accountId))
    .single()
  
  let userId: string
  
  if (existingUser) {
    // Update existing user
    const { data: updatedUser, error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        nickname,
        access_token: accessToken,
        expires_at: expiresAt ? parseInt(expiresAt) : null,
        updated_at: new Date().toISOString()
      })
      .eq('id', existingUser.id)
      .select()
      .single()
    
    if (updateError) throw updateError
    userId = updatedUser.id
  } else {
    // Create new user
    const { data: newUser, error: createError } = await supabaseAdmin
      .from('users')
      .insert({
        account_id: parseInt(accountId),
        nickname,
        access_token: accessToken,
        expires_at: expiresAt ? parseInt(expiresAt) : null,
      })
      .select()
      .single()
    
    if (createError) throw createError
    userId = newUser.id
  }
  
  // Create Supabase session
  const supabase = createRouteHandlerClient({ cookies })
  
  // Create custom JWT or use email-less auth
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: `lesta_${accountId}@wot-challenges.com`,
    password: crypto.randomUUID(),
    email_confirm: true,
    user_metadata: {
      account_id: accountId,
      nickname,
      user_id: userId
    }
  })
  
  if (authError && !authError.message.includes('already exists')) {
    throw authError
  }
  
  return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/challenges?auth=success`)
}
