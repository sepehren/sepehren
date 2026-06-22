import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { BlockFormat } from '@prisma/client'

const exerciseSchema = z.object({
  name: z.string().min(1),
  libraryId: z.string().optional(),
  order: z.number().int().default(0),
  reps: z.number().int().optional(),
  sets: z.number().int().optional(),
  load: z.number().optional(),
  loadUnit: z.string().optional(),
  rpe: z.number().optional(),
  distance: z.string().optional(),
  calories: z.number().int().optional(),
  duration: z.string().optional(),
  tempo: z.string().optional(),
  note: z.string().optional(),
})

const blockSchema = z.object({
  format: z.nativeEnum(BlockFormat),
  title: z.string().optional(),
  order: z.number().int().default(0),
  minutes: z.number().int().optional(),
  interval: z.number().int().optional(),
  rounds: z.number().int().optional(),
  sets: z.number().int().optional(),
  scheme: z.string().optional(),
  rest: z.string().optional(),
  cap: z.string().optional(),
  note: z.string().optional(),
  exercises: z.array(exerciseSchema).default([]),
})

const sectionSchema = z.object({
  label: z.string().min(1),
  order: z.number().int().default(0),
  blocks: z.array(blockSchema).default([]),
})

const putDaySchema = z.object({
  name: z.string().min(1).optional(),
  focus: z.string().optional(),
  order: z.number().int().optional(),
  sections: z.array(sectionSchema),
})

async function verifyOwnership(planId: string, dayId: string, coachId: string) {
  const day = await prisma.workoutDay.findUnique({
    where: { id: dayId },
    include: { plan: { select: { ownerId: true } } },
  })
  if (!day || day.planId !== planId || day.plan.ownerId !== coachId) return null
  return day
}

// ── GET /api/plans/:id/days/:dayId ─────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; dayId: string }> }
) {
  try {
    const session = await getSession(request)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role !== 'COACH') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id, dayId } = await params
    const day = await verifyOwnership(id, dayId, session.userId)
    if (!day) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const full = await prisma.workoutDay.findUnique({
      where: { id: dayId },
      include: {
        sections: {
          orderBy: { order: 'asc' },
          include: { blocks: { orderBy: { order: 'asc' }, include: { exercises: { orderBy: { order: 'asc' } } } } },
        },
      },
    })

    return NextResponse.json({ day: full })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── PUT /api/plans/:id/days/:dayId ─────────────────────────────────────────
// Replaces a day's sections/blocks/exercises in one transaction.
// This is the builder "save day" action.

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; dayId: string }> }
) {
  try {
    const session = await getSession(request)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role !== 'COACH') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id, dayId } = await params
    const existing = await verifyOwnership(id, dayId, session.userId)
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = await request.json()
    const parsed = putDaySchema.safeParse(body)
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Invalid input'
      return NextResponse.json({ error: message }, { status: 400 })
    }

    const { name, focus, order, sections } = parsed.data

    const day = await prisma.$transaction(async (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => {
      // Delete all existing sections (cascades to blocks → exercises)
      await tx.workoutSection.deleteMany({ where: { dayId } })

      // Update day metadata + recreate sections
      return tx.workoutDay.update({
        where: { id: dayId },
        data: {
          ...(name !== undefined && { name }),
          ...(focus !== undefined && { focus }),
          ...(order !== undefined && { order }),
          sections: {
            create: sections.map((section) => ({
              label: section.label,
              order: section.order,
              blocks: {
                create: section.blocks.map((block) => ({
                  format: block.format,
                  title: block.title,
                  order: block.order,
                  minutes: block.minutes,
                  interval: block.interval,
                  rounds: block.rounds,
                  sets: block.sets,
                  scheme: block.scheme,
                  rest: block.rest,
                  cap: block.cap,
                  note: block.note,
                  exercises: {
                    create: block.exercises.map((ex) => ({
                      name: ex.name,
                      libraryId: ex.libraryId,
                      order: ex.order,
                      reps: ex.reps,
                      sets: ex.sets,
                      load: ex.load,
                      loadUnit: ex.loadUnit,
                      rpe: ex.rpe,
                      distance: ex.distance,
                      calories: ex.calories,
                      duration: ex.duration,
                      tempo: ex.tempo,
                      note: ex.note,
                    })),
                  },
                })),
              },
            })),
          },
        },
        include: {
          sections: {
            orderBy: { order: 'asc' },
            include: { blocks: { orderBy: { order: 'asc' }, include: { exercises: { orderBy: { order: 'asc' } } } } },
          },
        },
      })
    })

    return NextResponse.json({ day })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── DELETE /api/plans/:id/days/:dayId ──────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; dayId: string }> }
) {
  try {
    const session = await getSession(request)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role !== 'COACH') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id, dayId } = await params
    const existing = await verifyOwnership(id, dayId, session.userId)
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await prisma.workoutDay.delete({ where: { id: dayId } })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
