import type { ReportBase } from './types'

export interface SessionInput {
  id: string
  completedAt: Date | string | null
  rating: number | null
  painFlag: boolean
  planName: string
  dayName: string
}

export interface WorkoutReportData {
  totalCompleted: number
  // Completion rate = completed / (completed + skipped) over the window
  completionRate: number | null
  averageRating: number | null
  painFlagCount: number
  recentSessions: SessionInput[]
  trend: 'improving' | 'declining' | 'stable' | null
}

export interface WorkoutReport extends ReportBase {
  data: WorkoutReportData | null
}

// Minimum sessions required before we report a trend
const MIN_FOR_TREND = 4
const MIN_FOR_REPORT = 2

export function buildWorkoutReport(
  completed: SessionInput[],
  skippedCount: number,
  windowDays = 30
): WorkoutReport {
  const now = new Date()
  const windowStart = new Date(now.getTime() - windowDays * 86_400_000)

  const inWindow = completed.filter((s) => {
    const at = s.completedAt ? new Date(s.completedAt) : null
    return at && at >= windowStart
  })

  const generatedAt = now.toISOString()

  if (inWindow.length < MIN_FOR_REPORT) {
    return { status: 'insufficient_data', generatedAt, data: null }
  }

  const totalCompleted = inWindow.length
  const totalAttempted = totalCompleted + skippedCount
  const completionRate = totalAttempted > 0
    ? Math.round((totalCompleted / totalAttempted) * 100)
    : null

  const rated = inWindow.filter((s) => s.rating !== null)
  const averageRating = rated.length > 0
    ? Math.round((rated.reduce((sum, s) => sum + s.rating!, 0) / rated.length) * 10) / 10
    : null

  const painFlagCount = inWindow.filter((s) => s.painFlag).length

  // Trend: compare avg rating first half vs second half of the window
  // Only reported when there are enough data points
  let trend: WorkoutReportData['trend'] = null
  if (rated.length >= MIN_FOR_TREND) {
    const sorted = [...rated].sort(
      (a, b) => new Date(a.completedAt!).getTime() - new Date(b.completedAt!).getTime()
    )
    const mid = Math.floor(sorted.length / 2)
    const firstHalf = sorted.slice(0, mid)
    const secondHalf = sorted.slice(mid)
    const avgFirst = firstHalf.reduce((s, x) => s + x.rating!, 0) / firstHalf.length
    const avgSecond = secondHalf.reduce((s, x) => s + x.rating!, 0) / secondHalf.length
    const delta = avgSecond - avgFirst
    if (delta >= 0.5) trend = 'improving'
    else if (delta <= -0.5) trend = 'declining'
    else trend = 'stable'
  }

  return {
    status: 'ok',
    generatedAt,
    data: {
      totalCompleted,
      completionRate,
      averageRating,
      painFlagCount,
      recentSessions: inWindow.slice(-5).reverse(),
      trend,
    },
  }
}
