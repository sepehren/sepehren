// Vercel Cron: runs daily to advance CheckInSchedule.nextDueAt.
// Configure in vercel.json: { "crons": [{ "path": "/api/cron/checkins", "schedule": "0 6 * * *" }] }

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()

  // Find all active schedules where nextDueAt has passed
  const overdue = await prisma.checkInSchedule.findMany({
    where: { active: true, nextDueAt: { lte: now } },
  })

  let advanced = 0
  for (const schedule of overdue) {
    const intervalDays = schedule.cadence === 'biweekly' ? 14 : 7
    const next = new Date(schedule.nextDueAt)
    // Advance until nextDueAt is in the future
    while (next <= now) {
      next.setDate(next.getDate() + intervalDays)
    }

    await prisma.checkInSchedule.update({
      where: { id: schedule.id },
      data: { nextDueAt: next },
    })
    advanced++
  }

  return NextResponse.json({ advanced, checked: overdue.length })
}
