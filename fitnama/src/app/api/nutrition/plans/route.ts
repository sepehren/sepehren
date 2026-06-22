import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'

const mealSchema = z.object({
  name: z.string().min(1),
  guidance: z.string().optional(),
  kcal: z.number().int().min(0).default(0),
  order: z.number().int().default(0),
})

const createPlanSchema = z.object({
  name: z.string().min(1, 'Plan name is required'),
  calories: z.number().int().min(0),
  protein: z.number().int().min(0),
  carbs: z.number().int().min(0),
  fat: z.number().int().min(0),
  water: z.number().optional(),
  allowed: z.array(z.string()).default([]),
  restricted: z.array(z.string()).default([]),
  notes: z.string().optional(),
  meals: z.array(mealSchema).default([]),
})

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role !== 'COACH') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const plans = await prisma.nutritionPlan.findMany({
      where: { ownerId: session.userId },
      orderBy: { updatedAt: 'desc' },
      include: { meals: { orderBy: { order: 'asc' } } },
    })

    return NextResponse.json({ plans })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role !== 'COACH') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json()
    const parsed = createPlanSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
    }

    const { meals, ...planData } = parsed.data

    const plan = await prisma.$transaction(async (tx) =>
      tx.nutritionPlan.create({
        data: {
          ownerId: session.userId,
          ...planData,
          meals: { create: meals },
        },
        include: { meals: { orderBy: { order: 'asc' } } },
      })
    )

    return NextResponse.json({ plan }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
