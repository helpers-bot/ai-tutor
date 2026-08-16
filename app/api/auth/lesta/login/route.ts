import { NextResponse } from 'next/server'

export async function GET() {
  const applicationId = process.env.LESTA_APPLICATION_ID
  const redirectUri = process.env.LESTA_REDIRECT_URI
  
  const authUrl = `https://api.lestagames.ru/wot/auth/login/?application_id=${applicationId}&redirect_uri=${redirectUri}&display=page&nofollow=1`
  
  return NextResponse.redirect(authUrl)
}
