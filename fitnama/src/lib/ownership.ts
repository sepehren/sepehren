import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

export class OwnershipError extends Error {
  constructor(message = 'Forbidden') {
    super(message)
    this.name = 'OwnershipError'
  }
}

export function forbidden() {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

/**
 * Verifies the coach owns the athlete relationship.
 * Throws OwnershipError (→ 403) if not found.
 */
export async function assertCoachOwnsAthlete(coachId: string, athleteId: string) {
  const link = await prisma.coachAthlete.findUnique({
    where: { coachId_athleteId: { coachId, athleteId } },
  })
  if (!link) throw new OwnershipError()
  return link
}

/**
 * Verifies the session user IS the athlete (self-access only).
 * Throws OwnershipError (→ 403) if mismatch.
 */
export function assertAthleteSelf(sessionUserId: string, athleteId: string) {
  if (sessionUserId !== athleteId) throw new OwnershipError()
}

export function isOwnershipError(e: unknown): e is OwnershipError {
  return e instanceof OwnershipError
}
