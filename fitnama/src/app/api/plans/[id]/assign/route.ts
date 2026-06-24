export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { assertCoachOwnsAthlete } from '@/lib/ownership'

const assignSchema = z.object({
  athleteId: z.string().min(1, 'athleteId is required'),
  dayId: z.string().min(1, 'dayId is required'),
  scheduledFor: z.string().datetime().optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(request)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role !== 'COACH') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id: planId } = await params

    const body = await request.json()
    const parsed = assignSchema.safeParse(body)
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Invalid input'
      return NextResponse.json({ error: message }, { status: 400 })
    }

    const { athleteId, dayId, scheduledFor } = parsed.data

    // Ownership: coach must own the plan
    const plan = await prisma.workoutPlan.findUnique({ where: { id: planId } })
    if (!plan || plan.ownerId !== session.userId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Ownership: coach must own the athlete relationship
    await assertCoachOwnsAthlete(session.userId, athleteId)

    // Fetch the day with full hierarchy for the snapshot
    const day = await prisma.workoutDay.findUnique({
      where: { id: dayId },
      include: {
        sections: {
          orderBy: { order: 'asc' },
          include: {
            blocks: {
              orderBy: { order: 'asc' },
              include: { exercises: { orderBy: { order: 'asc' } } },
            },
          },
        },
      },
    })

    if (!day || day.planId !== planId) {
      return NextResponse.json({ error: 'Day not found in this plan' }, { status: 404 })
    }

    // Freeze the day as a JSON snapshot — plan edits will never rewrite this
    const daySnapshot = JSON.parse(JSON.stringify(day))

    const { assignment, session: workoutSession } = await prisma.$transaction(async (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => {
      const assignment = await tx.assignment.create({
        data: { planId, athleteId, coachId: session.userId },
      })

      const workoutSession = await tx.workoutSession.create({
        data: {
          assignmentId: assignment.id,
          athleteId,
          planName: plan.name,
          dayName: day.name,
          daySnapshot,
          scheduledFor: scheduledFor ? new Date(scheduledFor) : new Date(),
          status: 'SCHEDULED',
        },
      })

      // Mark plan as ASSIGNED if it was DRAFT
      if (plan.status === 'DRAFT') {
        await tx.workoutPlan.update({
          where: { id: planId },
          data: { status: 'ASSIGNED' },
        })
      }

      return { assignment, session: workoutSession }
    })

    return NextResponse.json(
      { assignment: { id: assignment.id }, session: { id: workoutSession.id, status: workoutSession.status } },
      { status: 201 }
    )
  } catch (e) {
    if (e instanceof Error && e.name === 'OwnershipError') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
