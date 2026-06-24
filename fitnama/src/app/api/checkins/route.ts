export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'

const submitSchema = z.object({
  energy: z.number().int().min(1).max(5),
  soreness: z.number().int().min(1).max(5),
  stress: z.number().int().min(1).max(5),
  sleep: z.number().int().min(1).max(5),
  confidence: z.number().int().min(1).max(5),
  nutrition: z.enum(['On track', 'Slipped', 'Off plan']).optional(),
  blockers: z.string().optional(),
  note: z.string().optional(),
})

// POST /api/checkins — athlete submits a check-in
export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role !== 'ATHLETE') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json()
    const parsed = submitSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
    }

    const checkIn = await prisma.checkIn.create({
      data: { athleteId: session.userId, ...parsed.data },
    })

    return NextResponse.json({ checkIn }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET /api/checkins — coach lists unreviewed check-ins for their athletes
export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role !== 'COACH') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const links = await prisma.coachAthlete.findMany({
      where: { coachId: session.userId, status: 'active' },
      select: { athleteId: true },
    })
    const athleteIds = links.map((l) => l.athleteId)

    const { searchParams } = request.nextUrl
    const reviewed = searchParams.get('reviewed') === 'true'

    const checkIns = await prisma.checkIn.findMany({
      where: { athleteId: { in: athleteIds }, reviewed },
      orderBy: { submittedAt: 'desc' },
      include: { athlete: { select: { id: true, name: true, avatarHue: true } } },
    })

    return NextResponse.json({ checkIns })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
