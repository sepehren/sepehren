import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { assertCoachOwnsAthlete } from '@/lib/ownership'
import { buildWorkoutReport } from '@/lib/reports/workout'
import { buildNutritionReport } from '@/lib/reports/nutrition'
import { buildProgressReport } from '@/lib/reports/progress'
import { buildRiskReport } from '@/lib/reports/risk'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ athleteId: string }> }
) {
  try {
    const session = await getSession(request)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role !== 'COACH') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { athleteId } = await params

    await assertCoachOwnsAthlete(session.userId, athleteId)

    // All data fetched in parallel — no sequential N+1
    const [completedSessions, skippedCount, foodLogs, nutritionPlan, progressEntries, checkIns] =
      await Promise.all([
        prisma.workoutSession.findMany({
          where: { athleteId, status: 'COMPLETED' },
          orderBy: { completedAt: 'desc' },
          take: 60,
          select: {
            id: true, completedAt: true, rating: true,
            painFlag: true, planName: true, dayName: true,
          },
        }),
        prisma.workoutSession.count({ where: { athleteId, status: 'SKIPPED' } }),
        prisma.foodLog.findMany({
          where: { athleteId },
          orderBy: { loggedFor: 'desc' },
          take: 60,
          select: { loggedFor: true, kcal: true, protein: true, carbs: true, fat: true },
        }),
        prisma.nutritionPlan.findFirst({
          where: { athleteId, status: 'ASSIGNED' },
          select: { calories: true, protein: true, carbs: true, fat: true },
        }),
        prisma.progressEntry.findMany({
          where: { athleteId },
          orderBy: { recordedAt: 'desc' },
          take: 30,
          select: { id: true, recordedAt: true, weightKg: true, measurements: true },
        }),
        prisma.checkIn.findMany({
          where: { athleteId },
          orderBy: { submittedAt: 'desc' },
          take: 20,
          select: { energy: true, soreness: true, stress: true, sleep: true, confidence: true, submittedAt: true },
        }),
      ])

    // Aggregate food logs by day for the nutrition report
    const dayLogMap = new Map<string, { kcal: number; protein: number; carbs: number; fat: number }>()
    for (const l of foodLogs) {
      const date = new Date(l.loggedFor).toISOString().split('T')[0]
      const existing = dayLogMap.get(date) ?? { kcal: 0, protein: 0, carbs: 0, fat: 0 }
      dayLogMap.set(date, {
        kcal: existing.kcal + l.kcal,
        protein: existing.protein + l.protein,
        carbs: existing.carbs + l.carbs,
        fat: existing.fat + l.fat,
      })
    }
    const dayLogs = Array.from(dayLogMap.entries()).map(([date, v]) => ({ date, ...v }))

    const recentPainFlag = completedSessions.some((s) => s.painFlag)

    const workout = buildWorkoutReport(completedSessions, skippedCount)
    const nutrition = buildNutritionReport(dayLogs, nutritionPlan ?? null)
    const progress = buildProgressReport(
      progressEntries.map((e) => ({
        ...e,
        measurements: e.measurements as Record<string, number> | null,
      }))
    )
    const risk = buildRiskReport(checkIns, recentPainFlag, athleteId)

    return NextResponse.json({ workout, nutrition, progress, risk })
  } catch (e) {
    if (e instanceof Error && e.name === 'OwnershipError') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
