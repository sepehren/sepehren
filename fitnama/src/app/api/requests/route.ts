export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { RequestType } from '@prisma/client'

const createSchema = z.object({
  type: z.nativeEnum(RequestType),
  reason: z.string().min(1, 'Reason is required'),
})

// POST /api/requests — athlete opens a program request
export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role !== 'ATHLETE') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
    }

    // Find the athlete's coach
    const link = await prisma.coachAthlete.findFirst({
      where: { athleteId: session.userId, status: 'active' },
      select: { coachId: true },
    })
    if (!link) {
      return NextResponse.json({ error: 'No active coach relationship found' }, { status: 422 })
    }

    const req = await prisma.programRequest.create({
      data: {
        athleteId: session.userId,
        coachId: link.coachId,
        type: parsed.data.type,
        reason: parsed.data.reason,
      },
    })

    return NextResponse.json({ request: req }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET /api/requests — coach lists requests from their athletes
export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role !== 'COACH') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { searchParams } = request.nextUrl
    const status = searchParams.get('status') ?? 'OPEN'

    const requests = await prisma.programRequest.findMany({
      where: { coachId: session.userId, status: status as never },
      orderBy: { createdAt: 'desc' },
      include: { athlete: { select: { id: true, name: true, avatarHue: true } } },
    })

    return NextResponse.json({ requests })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
