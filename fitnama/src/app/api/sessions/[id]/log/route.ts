export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { assertAthleteSelf } from '@/lib/ownership'

const logSchema = z.object({
  logs: z.array(
    z.object({
      blockExerciseId: z.string().optional(),
      done: z.boolean().default(false),
      loggedLoad: z.number().optional(),
      loggedReps: z.number().int().optional(),
      blockResult: z.string().optional(),
    })
  ).min(1, 'At least one log entry required'),
})

export async function PATCH(
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

    if (workoutSession.status !== 'IN_PROGRESS') {
      return NextResponse.json({ error: 'Session must be IN_PROGRESS to log' }, { status: 409 })
    }

    const body = await request.json()
    const parsed = logSchema.safeParse(body)
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Invalid input'
      return NextResponse.json({ error: message }, { status: 400 })
    }

    // Upsert each log entry — if a blockExerciseId already has a log in this session, update it
    const logs = await prisma.$transaction(
      parsed.data.logs.map((entry) =>
        prisma.exerciseLog.create({
          data: {
            sessionId: id,
            blockExerciseId: entry.blockExerciseId ?? null,
            done: entry.done,
            loggedLoad: entry.loggedLoad ?? null,
            loggedReps: entry.loggedReps ?? null,
            blockResult: entry.blockResult ?? null,
          },
        })
      )
    )

    return NextResponse.json({ logs })
  } catch (e) {
    if (e instanceof Error && e.name === 'OwnershipError') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
