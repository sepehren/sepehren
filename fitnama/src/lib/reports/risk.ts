import type { ReportBase } from './types'

export interface CheckInInput {
  energy: number      // 1–5
  soreness: number    // 1–5
  stress: number      // 1–5
  sleep: number       // 1–5
  confidence: number  // 1–5
  submittedAt: Date | string
}

export type RiskLevel = 'low' | 'moderate' | 'high'

export interface RiskFlag {
  signal: string
  detail: string
  // Links back to the relevant resource the coach can act on
  actionLink: string
}

export interface RiskReportData {
  riskLevel: RiskLevel
  flags: RiskFlag[]
  avgEnergy: number | null
  avgSoreness: number | null
  avgStress: number | null
  avgSleep: number | null
}

export interface RiskReport extends ReportBase {
  data: RiskReportData | null
}

const MIN_CHECKINS = 3

export function buildRiskReport(
  checkIns: CheckInInput[],
  recentPainFlag: boolean,
  athleteId: string,
  windowDays = 21
): RiskReport {
  const now = new Date()
  const generatedAt = now.toISOString()
  const windowStart = new Date(now.getTime() - windowDays * 86_400_000)

  const inWindow = checkIns
    .filter((c) => new Date(c.submittedAt) >= windowStart)
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())

  if (inWindow.length < MIN_CHECKINS && !recentPainFlag) {
    return { status: 'insufficient_data', generatedAt, data: null }
  }

  const n = inWindow.length
  const avg = (key: keyof CheckInInput) =>
    n > 0
      ? Math.round((inWindow.reduce((s, c) => s + (c[key] as number), 0) / n) * 10) / 10
      : null

  const avgEnergy = avg('energy')
  const avgSoreness = avg('soreness')
  const avgStress = avg('stress')
  const avgSleep = avg('sleep')

  const flags: RiskFlag[] = []

  if (recentPainFlag) {
    flags.push({
      signal: 'Pain reported',
      detail: 'Athlete flagged pain in their last session.',
      actionLink: `/coach/athletes/${athleteId}/sessions`,
    })
  }

  if (avgEnergy !== null && avgEnergy <= 2) {
    flags.push({
      signal: 'Chronically low energy',
      detail: `Average energy ${avgEnergy}/5 over the last ${n} check-ins.`,
      actionLink: `/coach/athletes/${athleteId}/checkins`,
    })
  }

  if (avgSoreness !== null && avgSoreness >= 4) {
    flags.push({
      signal: 'Persistently high soreness',
      detail: `Average soreness ${avgSoreness}/5 — potential overtraining signal.`,
      actionLink: `/coach/athletes/${athleteId}/checkins`,
    })
  }

  if (avgStress !== null && avgStress >= 4) {
    flags.push({
      signal: 'Elevated stress',
      detail: `Average stress ${avgStress}/5 — may affect recovery and adherence.`,
      actionLink: `/coach/athletes/${athleteId}/checkins`,
    })
  }

  if (avgSleep !== null && avgSleep <= 2) {
    flags.push({
      signal: 'Poor sleep',
      detail: `Average sleep quality ${avgSleep}/5 — impacts recovery and performance.`,
      actionLink: `/coach/athletes/${athleteId}/checkins`,
    })
  }

  const riskLevel: RiskLevel =
    flags.length >= 3 ? 'high'
    : flags.length >= 1 ? 'moderate'
    : 'low'

  return {
    status: 'ok',
    generatedAt,
    data: { riskLevel, flags, avgEnergy, avgSoreness, avgStress, avgSleep },
  }
}
