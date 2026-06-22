import type { ReportBase } from './types'

export interface ProgressEntryInput {
  id: string
  recordedAt: Date | string
  weightKg: number | null
  measurements: Record<string, number> | null
}

export interface ProgressReportData {
  entries: number
  // Weight change over the window — null if fewer than 2 weight entries
  weightChangeKg: number | null
  weightTrend: 'gaining' | 'losing' | 'stable' | null
  // Per-measurement deltas (e.g. waist: -2cm) — only included if 2+ readings exist
  measurementDeltas: Record<string, number>
  latestWeight: number | null
  latestMeasurements: Record<string, number> | null
}

export interface ProgressReport extends ReportBase {
  data: ProgressReportData | null
}

const MIN_ENTRIES = 2

export function buildProgressReport(
  entries: ProgressEntryInput[],
  windowDays = 90
): ProgressReport {
  const now = new Date()
  const generatedAt = now.toISOString()
  const windowStart = new Date(now.getTime() - windowDays * 86_400_000)

  const inWindow = entries
    .filter((e) => new Date(e.recordedAt) >= windowStart)
    .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime())

  if (inWindow.length < MIN_ENTRIES) {
    return { status: 'insufficient_data', generatedAt, data: null }
  }

  const withWeight = inWindow.filter((e) => e.weightKg !== null)
  let weightChangeKg: number | null = null
  let weightTrend: ProgressReportData['weightTrend'] = null

  if (withWeight.length >= 2) {
    const first = withWeight[0].weightKg!
    const last = withWeight[withWeight.length - 1].weightKg!
    weightChangeKg = Math.round((last - first) * 10) / 10
    if (Math.abs(weightChangeKg) < 0.5) weightTrend = 'stable'
    else weightTrend = weightChangeKg > 0 ? 'gaining' : 'losing'
  }

  // Measurement deltas: only for keys that appear in both oldest and newest entry
  const measurementDeltas: Record<string, number> = {}
  const oldest = inWindow[0].measurements ?? {}
  const newest = inWindow[inWindow.length - 1].measurements ?? {}
  for (const key of Object.keys(oldest)) {
    if (key in newest) {
      const delta = Math.round((newest[key] - oldest[key]) * 10) / 10
      measurementDeltas[key] = delta
    }
  }

  const latest = inWindow[inWindow.length - 1]

  return {
    status: 'ok',
    generatedAt,
    data: {
      entries: inWindow.length,
      weightChangeKg,
      weightTrend,
      measurementDeltas,
      latestWeight: latest.weightKg,
      latestMeasurements: latest.measurements,
    },
  }
}
