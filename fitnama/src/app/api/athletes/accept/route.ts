import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'

const acceptSchema = z.object({
  coachId: z.string().min(1, 'coachId is required'),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (session.role !== 'ATHLETE') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const parsed = acceptSchema.safeParse(body)
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Invalid input'
      return NextResponse.json({ error: message }, { status: 400 })
    }

    const { coachId } = parsed.data

    const link = await prisma.coachAthlete.findUnique({
      where: { coachId_athleteId: { coachId, athleteId: session.userId } },
    })

    if (!link) {
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
    }

    if (link.status === 'active') {
      return NextResponse.json({ error: 'Already accepted' }, { status: 409 })
    }

    const updated = await prisma.coachAthlete.update({
      where: { coachId_athleteId: { coachId, athleteId: session.userId } },
      data: { status: 'active', joinedAt: new Date() },
    })

    return NextResponse.json({ link: { id: updated.id, status: updated.status, joinedAt: updated.joinedAt } })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
