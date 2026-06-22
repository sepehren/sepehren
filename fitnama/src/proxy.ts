import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isCoachRoute = pathname.startsWith('/coach')
  const isAthleteRoute = pathname.startsWith('/athlete')

  if (!isCoachRoute && !isAthleteRoute) {
    return NextResponse.next()
  }

  const session = await getSession(request)

  if (!session) {
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  const { role } = session

  if (isCoachRoute && role !== 'COACH') {
    // Athlete hitting /coach -> redirect to their dashboard
    return NextResponse.redirect(new URL('/athlete', request.url))
  }

  if (isAthleteRoute && role !== 'ATHLETE') {
    // Coach hitting /athlete -> redirect to their dashboard
    return NextResponse.redirect(new URL('/coach', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/coach/:path*', '/athlete/:path*'],
}
