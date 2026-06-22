import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { computePriority } from '@/lib/priority'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role !== 'COACH') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const coachId = session.userId

    // Batch 1: all active athlete links for this coach
    const links = await prisma.coachAthlete.findMany({
      where: { coachId, status: 'active' },
      include: {
        athlete: { select: { id: true, name: true, email: true, avatarHue: true } },
        conversation: { select: { id: true, unreadForCoach: true } },
      },
    })

    if (links.length === 0) {
      return NextResponse.json({ queue: [] })
    }

    const athleteIds = links.map((l) => l.athleteId)

    // Batch 2: latest completed session per athlete
    const latestSessions = await prisma.workoutSession.findMany({
      where: { athleteId: { in: athleteIds }, status: 'COMPLETED' },
      orderBy: { completedAt: 'desc' },
      distinct: ['athleteId'],
      select: {
        athleteId: true,
        planName: true,
        rating: true,
        painFlag: true,
        painLocation: true,
        completedAt: true,
      },
    })

    // Batch 3: unreviewed check-in counts per athlete
    const unreviewedCounts = await prisma.checkIn.groupBy({
      by: ['athleteId'],
      where: { athleteId: { in: athleteIds }, reviewed: false },
      _count: { id: true },
    })

    // Batch 4: last 5 check-ins per athlete for streak calculation
    const recentCheckIns = await prisma.checkIn.findMany({
      where: { athleteId: { in: athleteIds } },
      orderBy: { submittedAt: 'desc' },
      select: { athleteId: true, energy: true, soreness: true, submittedAt: true },
      take: athleteIds.length * 5,
    })

    // Index the batched data
    const sessionByAthlete = new Map(latestSessions.map((s) => [s.athleteId, s]))
    const unreviewedByAthlete = new Map(unreviewedCounts.map((r) => [r.athleteId, r._count.id]))
    const checkInsByAthlete = new Map<string, typeof recentCheckIns>()
    for (const ci of recentCheckIns) {
      const arr = checkInsByAthlete.get(ci.athleteId) ?? []
      arr.push(ci)
      checkInsByAthlete.set(ci.athleteId, arr)
    }

    const now = Date.now()

    // Build the ranked queue
    const queue = links.map((link) => {
      const lastSession = sessionByAthlete.get(link.athleteId)
      const checkIns = checkInsByAthlete.get(link.athleteId) ?? []

      // Streak calculations over last 3 check-ins
      const last3 = checkIns.slice(0, 3)
      const lowEnergyStreak = countStreak(last3.map((c) => c.energy), (v) => v <= 2)
      const highSorenessStreak = countStreak(last3.map((c) => c.soreness), (v) => v >= 4)

      const lastSessionDaysAgo = lastSession?.completedAt
        ? Math.floor((now - new Date(lastSession.completedAt).getTime()) / 86_400_000)
        : null

      const signals = {
        painFlag: lastSession?.painFlag ?? false,
        painLocation: lastSession?.painLocation,
        planName: lastSession?.planName,
        lastRating: lastSession?.rating,
        unreviewedCheckIns: unreviewedByAthlete.get(link.athleteId) ?? 0,
        overdueCheckIns: 0, // Phase 3 adds CheckInSchedule overdue logic
        unreadMessages: link.conversation?.unreadForCoach ?? 0,
        lastSessionDaysAgo,
        lowEnergyStreak,
        highSorenessStreak,
      }

      const priority = computePriority(signals)

      return {
        athlete: link.athlete,
        link: { id: link.id, goal: link.goal },
        conversationId: link.conversation?.id ?? null,
        lastSession: lastSession ?? null,
        priority,
      }
    })

    // Sort by score descending
    queue.sort((a, b) => b.priority.score - a.priority.score)

    return NextResponse.json({ queue })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function countStreak(values: number[], predicate: (v: number) => boolean): number {
  let count = 0
  for (const v of values) {
    if (predicate(v)) count++
    else break
  }
  return count
}
