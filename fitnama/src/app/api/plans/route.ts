import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { BlockFormat } from '@prisma/client'

// ── Zod schemas ────────────────────────────────────────────────────────────

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

const daySchema = z.object({
  name: z.string().min(1),
  focus: z.string().optional(),
  order: z.number().int().default(0),
  sections: z.array(sectionSchema).default([]),
})

const createPlanSchema = z.object({
  name: z.string().min(1, 'Plan name is required'),
  goal: z.string().optional(),
  level: z.string().optional(),
  dayCount: z.number().int().min(1).max(30).default(3),
  isTemplate: z.boolean().default(false),
  days: z.array(daySchema).default([]),
})

// ── GET /api/plans ─────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role !== 'COACH') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const plans = await prisma.workoutPlan.findMany({
      where: { ownerId: session.userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { days: true, assignments: true } },
      },
    })

    return NextResponse.json({ plans })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── POST /api/plans ────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role !== 'COACH') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json()
    const parsed = createPlanSchema.safeParse(body)
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Invalid input'
      return NextResponse.json({ error: message }, { status: 400 })
    }

    const { name, goal, level, dayCount, isTemplate, days } = parsed.data

    const plan = await prisma.$transaction(async (tx) => {
      return tx.workoutPlan.create({
        data: {
          ownerId: session.userId,
          name,
          goal,
          level,
          dayCount,
          isTemplate,
          days: {
            create: days.map((day) => ({
              name: day.name,
              focus: day.focus,
              order: day.order,
              sections: {
                create: day.sections.map((section) => ({
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
            })),
          },
        },
        include: {
          days: {
            include: {
              sections: {
                include: { blocks: { include: { exercises: true } } },
              },
            },
          },
        },
      })
    })

    return NextResponse.json({ plan }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
