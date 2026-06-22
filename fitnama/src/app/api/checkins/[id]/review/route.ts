import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { assertCoachOwnsAthlete } from '@/lib/ownership'

const reviewSchema = z.object({
  followUp: z.string().min(1).optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(request)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role !== 'COACH') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id: checkInId } = await params

    const checkIn = await prisma.checkIn.findUnique({ where: { id: checkInId } })
    if (!checkIn) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Ownership: coach must own this athlete
    await assertCoachOwnsAthlete(session.userId, checkIn.athleteId)

    const body = await request.json().catch(() => ({}))
    const parsed = reviewSchema.safeParse(body)
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Invalid input'
      return NextResponse.json({ error: message }, { status: 400 })
    }

    const { followUp } = parsed.data

    const result = await prisma.$transaction(async (tx) => {
      // Mark check-in reviewed
      const reviewed = await tx.checkIn.update({
        where: { id: checkInId },
        data: {
          reviewed: true,
          reviewedAt: new Date(),
          ...(followUp ? { followUp } : {}),
        },
      })

      // If there's a follow-up message, persist it in the shared conversation
      let message = null
      if (followUp) {
        const link = await tx.coachAthlete.findUnique({
          where: { coachId_athleteId: { coachId: session.userId, athleteId: checkIn.athleteId } },
          include: { conversation: true },
        })

        if (link?.conversation) {
          message = await tx.message.create({
            data: {
              conversationId: link.conversation.id,
              authorId: session.userId,
              fromRole: 'COACH',
              body: followUp,
            },
          })

          // Bump unread counter for athlete
          await tx.conversation.update({
            where: { id: link.conversation.id },
            data: { unreadForAthlete: { increment: 1 } },
          })
        }
      }

      return { reviewed, message }
    })

    return NextResponse.json({
      checkIn: { id: result.reviewed.id, reviewed: result.reviewed.reviewed, followUp: result.reviewed.followUp },
      message: result.message ? { id: result.message.id } : null,
    })
  } catch (e) {
    if (e instanceof Error && e.name === 'OwnershipError') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
