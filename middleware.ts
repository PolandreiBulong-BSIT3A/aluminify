import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)

export function middleware(req: NextRequest) {
  const origin = req.headers.get('origin') || ''
  const isApi = req.nextUrl.pathname.startsWith('/api/')
  if (!isApi) return NextResponse.next()

  const res = NextResponse.next()

  // Allow only configured origins
  if (allowedOrigins.includes(origin)) {
    res.headers.set('Access-Control-Allow-Origin', origin)
    res.headers.set('Vary', 'Origin')
  }

  res.headers.set('Access-Control-Allow-Credentials', 'true')
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers: res.headers })
  }

  return res
}

export const config = {
  matcher: ['/api/:path*'],
}
