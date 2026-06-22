import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { assertCoachOwnsAthlete } from '@/lib/ownership'

const createSchema = z.object({
  athleteId: z.string().min(1),
  cadence: z.enum(['weekly', 'biweekly']).default('weekly'),
  weekday: z.number().int().min(0).max(6).default(1),
})

function nextDueDate(weekday: number): Date {
  const now = new Date()
  const day = now.getDay()
  let daysUntil = (weekday - day + 7) % 7
  if (daysUntil === 0) daysUntil = 7 // always schedule for next occurrence, not today
  const next = new Date(now)
  next.setDate(now.getDate() + daysUntil)
  next.setHours(9, 0, 0, 0)
  return next
}

// POST /api/checkin-schedules — coach sets up recurring check-in
export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role !== 'COACH') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
    }

    const { athleteId, cadence, weekday } = parsed.data

    await assertCoachOwnsAthlete(session.userId, athleteId)

    // Deactivate any existing schedule for this pair
    await prisma.checkInSchedule.updateMany({
      where: { athleteId, coachId: session.userId, active: true },
      data: { active: false },
    })

    const schedule = await prisma.checkInSchedule.create({
      data: {
        athleteId,
        coachId: session.userId,
        cadence,
        weekday,
        nextDueAt: nextDueDate(weekday),
      },
    })

    return NextResponse.json({ schedule }, { status: 201 })
  } catch (e) {
    if (e instanceof Error && e.name === 'OwnershipError') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET /api/checkin-schedules — coach lists schedules for their athletes
export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role !== 'COACH') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const schedules = await prisma.checkInSchedule.findMany({
      where: { coachId: session.userId, active: true },
      include: { athlete: { select: { id: true, name: true, avatarHue: true } } },
      orderBy: { nextDueAt: 'asc' },
    })

    return NextResponse.json({ schedules })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
