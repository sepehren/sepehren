export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { PlanStatus } from '@prisma/client'

const patchPlanSchema = z.object({
  name: z.string().min(1).optional(),
  goal: z.string().optional(),
  level: z.string().optional(),
  dayCount: z.number().int().min(1).max(30).optional(),
  status: z.nativeEnum(PlanStatus).optional(),
  isTemplate: z.boolean().optional(),
})

async function getOwnedPlan(planId: string, coachId: string) {
  const plan = await prisma.workoutPlan.findUnique({ where: { id: planId } })
  if (!plan) return null
  if (plan.ownerId !== coachId) return null
  return plan
}

// ── GET /api/plans/:id ─────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(request)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role !== 'COACH') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = await params
    const plan = await prisma.workoutPlan.findUnique({
      where: { id },
      include: {
        days: {
          orderBy: { order: 'asc' },
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
        },
      },
    })

    if (!plan || plan.ownerId !== session.userId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({ plan })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── PATCH /api/plans/:id ───────────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(request)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role !== 'COACH') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = await params
    if (!await getOwnedPlan(id, session.userId)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const body = await request.json()
    const parsed = patchPlanSchema.safeParse(body)
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Invalid input'
      return NextResponse.json({ error: message }, { status: 400 })
    }

    const plan = await prisma.workoutPlan.update({
      where: { id },
      data: parsed.data,
    })

    return NextResponse.json({ plan })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── DELETE /api/plans/:id ──────────────────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(request)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role !== 'COACH') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = await params
    if (!await getOwnedPlan(id, session.userId)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    await prisma.workoutPlan.delete({ where: { id } })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
