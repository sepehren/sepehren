export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'

async function verifyConversationAccess(conversationId: string, userId: string, role: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { link: true },
  })
  if (!conversation) return null

  const { coachId, athleteId } = conversation.link
  if (role === 'COACH' && coachId !== userId) return null
  if (role === 'ATHLETE' && athleteId !== userId) return null

  return conversation
}

// ── GET /api/conversations/:id/messages ────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(request)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const conversation = await verifyConversationAccess(id, session.userId, session.role)
    if (!conversation) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const messages = await prisma.message.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: 'asc' },
      include: { author: { select: { id: true, name: true, role: true, avatarHue: true } } },
    })

    // Mark as read: reset the unread counter for whoever is reading
    await prisma.conversation.update({
      where: { id },
      data:
        session.role === 'COACH'
          ? { unreadForCoach: 0 }
          : { unreadForAthlete: 0 },
    })

    return NextResponse.json({ messages })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── POST /api/conversations/:id/messages ───────────────────────────────────

const sendSchema = z.object({
  body: z.string().min(1, 'Message body is required'),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(request)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const conversation = await verifyConversationAccess(id, session.userId, session.role)
    if (!conversation) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const bodyRaw = await request.json()
    const parsed = sendSchema.safeParse(bodyRaw)
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Invalid input'
      return NextResponse.json({ error: message }, { status: 400 })
    }

    const { message, unreadUpdate } = await prisma.$transaction(async (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => {
      const message = await tx.message.create({
        data: {
          conversationId: id,
          authorId: session.userId,
          fromRole: session.role as 'COACH' | 'ATHLETE',
          body: parsed.data.body,
        },
        include: { author: { select: { id: true, name: true, role: true, avatarHue: true } } },
      })

      // Increment unread for the other party
      const unreadUpdate = await tx.conversation.update({
        where: { id },
        data:
          session.role === 'COACH'
            ? { unreadForAthlete: { increment: 1 } }
            : { unreadForCoach: { increment: 1 } },
      })

      return { message, unreadUpdate }
    })

    return NextResponse.json({ message, unreadForCoach: unreadUpdate.unreadForCoach, unreadForAthlete: unreadUpdate.unreadForAthlete }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
