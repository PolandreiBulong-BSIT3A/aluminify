import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const googleAuthUrl = `https://accounts.google.com/oauth/authorize?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=${process.env.GOOGLE_REDIRECT_URI}&scope=openid%20profile%20email&response_type=code`

  return NextResponse.redirect(googleAuthUrl)
}
