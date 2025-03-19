import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req: request, res })

  try {
    // Get current session without auto-refresh
    const {
      data: { session },
    } = await supabase.auth.getSession()

    // Protected routes that require authentication
    const protectedPaths = ['/dashboard', '/upload', '/scan']
    const isProtectedPath = protectedPaths.some(path => 
      request.nextUrl.pathname.startsWith(path)
    )

    // For auth page, redirect to dashboard if already logged in
    if (request.nextUrl.pathname === '/auth' && session) {
      const redirectPath = request.nextUrl.searchParams.get('redirect') || '/dashboard'
      return NextResponse.redirect(new URL(redirectPath, request.url))
    }

    // Add session user to request headers for protected routes if session exists
    if (session?.user) {
      res.headers.set('x-user-id', session.user.id)
    }

    // Important: Don't redirect protected routes in middleware
    // Let the client-side handle auth redirects
    return res
  } catch (error) {
    return res
  }
}

export const config = {
  matcher: ['/dashboard/:path*', '/upload/:path*', '/scan/:path*', '/auth']
}
