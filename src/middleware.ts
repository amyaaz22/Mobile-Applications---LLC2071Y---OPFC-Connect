import { type NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  // No redirects — all auth handled client-side in Guards
  return NextResponse.next()
}

export const config = {
  matcher: []
}
