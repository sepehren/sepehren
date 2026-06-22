import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { PlanStatus } from '@prisma/client'

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  calories: z.number().int().min(0).optional(),
  protein: z.number().int().min(0).optional(),
  carbs: z.number().int().min(0).optional(),
  fat: z.number().int().min(0).optional(),
  water: z.number().optional(),
  allowed: z.array(z.string()).optional(),
  restricted: z.array(z.string()).optional(),
  notes: z.string().optional(),
  status: z.nativeEnum(PlanStatus).optional(),
})

async function getOwned(id: string, coachId: string) {
  const plan = await prisma.nutritionPlan.findUnique({ where: { id } })
  if (!plan || plan.ownerId !== coachId) return null
  return plan
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession(request)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role !== 'COACH') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = await params
    const plan = await prisma.nutritionPlan.findUnique({
      where: { id },
      include: { meals: { orderBy: { order: 'asc' } } },
    })
    if (!plan || plan.ownerId !== session.userId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({ plan })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession(request)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role !== 'COACH') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = await params
    if (!await getOwned(id, session.userId)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = await request.json()
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
    }

    const plan = await prisma.nutritionPlan.update({ where: { id }, data: parsed.data })
    return NextResponse.json({ plan })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession(request)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role !== 'COACH') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = await params
    if (!await getOwned(id, session.userId)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await prisma.nutritionPlan.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
