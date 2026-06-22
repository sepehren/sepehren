import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role !== 'ATHLETE') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const workoutSession = await prisma.workoutSession.findFirst({
      where: {
        athleteId: session.userId,
        status: { in: ['SCHEDULED', 'IN_PROGRESS'] },
      },
      orderBy: { scheduledFor: 'asc' },
      include: {
        logs: true,
        prs: true,
      },
    })

    if (!workoutSession) {
      return NextResponse.json({ session: null })
    }

    return NextResponse.json({ session: workoutSession })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
