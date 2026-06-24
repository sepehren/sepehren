export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'

const createSchema = z.object({
  weightKg: z.number().positive().optional(),
  measurements: z.record(z.string(), z.number()).optional(),
  note: z.string().optional(),
  // photoUrls must be object-storage URLs, never base64 bytes
  photoUrls: z.array(z.string().url()).default([]),
  recordedAt: z.string().datetime().optional(),
})

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

    const { recordedAt, ...rest } = parsed.data

    const entry = await prisma.progressEntry.create({
      data: {
        athleteId: session.userId,
        recordedAt: recordedAt ? new Date(recordedAt) : new Date(),
        ...rest,
      },
    })

    return NextResponse.json({ entry }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role !== 'ATHLETE') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const entries = await prisma.progressEntry.findMany({
      where: { athleteId: session.userId },
      orderBy: { recordedAt: 'desc' },
      take: 50,
    })

    return NextResponse.json({ entries })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
