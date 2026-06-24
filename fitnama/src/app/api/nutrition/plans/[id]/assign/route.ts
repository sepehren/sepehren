export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { assertCoachOwnsAthlete } from '@/lib/ownership'

const assignSchema = z.object({
  athleteId: z.string().min(1, 'athleteId is required'),
})

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession(request)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role !== 'COACH') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = await params
    const plan = await prisma.nutritionPlan.findUnique({ where: { id } })
    if (!plan || plan.ownerId !== session.userId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const body = await request.json()
    const parsed = assignSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
    }

    await assertCoachOwnsAthlete(session.userId, parsed.data.athleteId)

    const updated = await prisma.nutritionPlan.update({
      where: { id },
      data: { athleteId: parsed.data.athleteId, status: 'ASSIGNED' },
    })

    return NextResponse.json({ plan: updated })
  } catch (e) {
    if (e instanceof Error && e.name === 'OwnershipError') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
