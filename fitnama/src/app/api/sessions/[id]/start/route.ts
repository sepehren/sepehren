export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { assertAthleteSelf } from '@/lib/ownership'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(request)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role !== 'ATHLETE') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = await params

    const workoutSession = await prisma.workoutSession.findUnique({ where: { id } })
    if (!workoutSession) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    assertAthleteSelf(session.userId, workoutSession.athleteId)

    if (workoutSession.status !== 'SCHEDULED') {
      return NextResponse.json({ error: 'Session is not in SCHEDULED state' }, { status: 409 })
    }

    const updated = await prisma.workoutSession.update({
      where: { id },
      data: { status: 'IN_PROGRESS', startedAt: new Date() },
    })

    return NextResponse.json({ session: updated })
  } catch (e) {
    if (e instanceof Error && e.name === 'OwnershipError') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
