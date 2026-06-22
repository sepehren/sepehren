import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'

const inviteSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(1, 'Name is required'),
  goal: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (session.role !== 'COACH') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const parsed = inviteSchema.safeParse(body)
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Invalid input'
      return NextResponse.json({ error: message }, { status: 400 })
    }

    const { email, name, goal } = parsed.data

    // Check if a user with this email already exists
    let athlete = await prisma.user.findUnique({ where: { email } })

    if (athlete) {
      if (athlete.role !== 'ATHLETE') {
        return NextResponse.json({ error: 'That email belongs to a coach account' }, { status: 409 })
      }
      // Athlete exists — check if already linked
      const existing = await prisma.coachAthlete.findUnique({
        where: { coachId_athleteId: { coachId: session.userId, athleteId: athlete.id } },
      })
      if (existing) {
        return NextResponse.json({ error: 'Athlete already in your roster' }, { status: 409 })
      }
    } else {
      // Create a new athlete account with a temporary password
      const tempHash = await bcrypt.hash(Math.random().toString(36) + Date.now(), 10)
      athlete = await prisma.user.create({
        data: { email, name, role: 'ATHLETE', passwordHash: tempHash },
      })
    }

    // Create the CoachAthlete link + Conversation in one transaction
    const result = await prisma.$transaction(async (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => {
      const link = await tx.coachAthlete.create({
        data: {
          coachId: session.userId,
          athleteId: athlete!.id,
          status: 'invited',
          goal: goal ?? null,
        },
      })
      const conversation = await tx.conversation.create({
        data: { linkId: link.id },
      })
      return { link, conversation }
    })

    return NextResponse.json(
      {
        athlete: { id: athlete.id, email: athlete.email, name: athlete.name },
        link: { id: result.link.id, status: result.link.status },
        conversationId: result.conversation.id,
      },
      { status: 201 }
    )
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
