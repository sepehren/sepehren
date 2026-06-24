export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { RequestStatus } from '@prisma/client'

const patchSchema = z.object({
  status: z.nativeEnum(RequestStatus),
  resolution: z.string().optional(),
})

// PATCH /api/requests/:id — coach updates status (IN_REVIEW, RESOLVED, DECLINED)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(request)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role !== 'COACH') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = await params

    const existing = await prisma.programRequest.findUnique({ where: { id } })
    if (!existing || existing.coachId !== session.userId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const body = await request.json()
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
    }

    const isResolved = ['RESOLVED', 'DECLINED'].includes(parsed.data.status)

    const updated = await prisma.programRequest.update({
      where: { id },
      data: {
        status: parsed.data.status,
        resolution: parsed.data.resolution ?? null,
        ...(isResolved ? { resolvedAt: new Date() } : {}),
      },
    })

    return NextResponse.json({ request: updated })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET /api/requests/:id — either party can view their own request
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(request)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const req = await prisma.programRequest.findUnique({ where: { id } })
    if (!req) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const canAccess =
      (session.role === 'COACH' && req.coachId === session.userId) ||
      (session.role === 'ATHLETE' && req.athleteId === session.userId)

    if (!canAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    return NextResponse.json({ request: req })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
