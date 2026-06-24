export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { assertAthleteSelf } from '@/lib/ownership'

const finishSchema = z.object({
  rating: z.number().int().min(1).max(5).optional(),
  painFlag: z.boolean().default(false),
  painLocation: z.string().optional(),
  feedbackNote: z.string().optional(),
})

// Derive PRs from the exercise logs in this session.
// A PR is recorded when the athlete logs a load × reps combination.
function derivePRs(
  logs: { done: boolean; loggedLoad: number | null; loggedReps: number | null; blockExerciseId: string | null }[],
  snapshot: Record<string, unknown>
): { name: string; value: string }[] {
  const prs: { name: string; value: string }[] = []

  // Build a quick lookup of exerciseId → name from the snapshot
  const nameMap = new Map<string, string>()
  const sections = (snapshot.sections ?? []) as {
    blocks: { exercises: { id: string; name: string }[] }[]
  }[]
  for (const section of sections) {
    for (const block of section.blocks ?? []) {
      for (const ex of block.exercises ?? []) {
        if (ex.id) nameMap.set(ex.id, ex.name)
      }
    }
  }

  for (const log of logs) {
    if (!log.done || !log.loggedLoad || !log.loggedReps || !log.blockExerciseId) continue
    const name = nameMap.get(log.blockExerciseId) ?? 'Exercise'
    prs.push({ name, value: `${log.loggedLoad}kg × ${log.loggedReps}` })
  }

  return prs
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(request)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role !== 'ATHLETE') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = await params

    const workoutSession = await prisma.workoutSession.findUnique({
      where: { id },
      include: { logs: true },
    })
    if (!workoutSession) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    assertAthleteSelf(session.userId, workoutSession.athleteId)

    if (workoutSession.status !== 'IN_PROGRESS') {
      return NextResponse.json({ error: 'Session must be IN_PROGRESS to finish' }, { status: 409 })
    }

    const body = await request.json()
    const parsed = finishSchema.safeParse(body)
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Invalid input'
      return NextResponse.json({ error: message }, { status: 400 })
    }

    const { rating, painFlag, painLocation, feedbackNote } = parsed.data

    const snapshot = workoutSession.daySnapshot as Record<string, unknown>
    const newPRs = derivePRs(workoutSession.logs, snapshot)

    const { finished, prs } = await prisma.$transaction(async (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => {
      const finished = await tx.workoutSession.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          rating: rating ?? null,
          painFlag,
          painLocation: painLocation ?? null,
          feedbackNote: feedbackNote ?? null,
        },
      })

      const prs = newPRs.length > 0
        ? await tx.personalRecord.createMany({
            data: newPRs.map((pr) => ({
              sessionId: id,
              athleteId: session.userId,
              name: pr.name,
              value: pr.value,
            })),
          })
        : { count: 0 }

      return { finished, prs }
    })

    return NextResponse.json({
      session: {
        id: finished.id,
        status: finished.status,
        completedAt: finished.completedAt,
        painFlag: finished.painFlag,
      },
      prsRecorded: prs.count,
    })
  } catch (e) {
    if (e instanceof Error && e.name === 'OwnershipError') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
