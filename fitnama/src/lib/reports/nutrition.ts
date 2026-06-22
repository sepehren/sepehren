import type { ReportBase } from './types'

export interface DayLog {
  date: string // YYYY-MM-DD
  kcal: number
  protein: number
  carbs: number
  fat: number
}

export interface NutritionTarget {
  calories: number
  protein: number
  carbs: number
  fat: number
}

export interface MacroAdherence {
  // % of days within ±15% of target
  calorieAdherence: number
  proteinAdherence: number
}

export interface NutritionReportData {
  daysLogged: number
  averageKcal: number
  averageProtein: number
  averageCarbs: number
  averageFat: number
  adherence: MacroAdherence | null // null when no target assigned
  trend: 'on_track' | 'under' | 'over' | null
}

export interface NutritionReport extends ReportBase {
  data: NutritionReportData | null
}

const MIN_DAYS = 3

export function buildNutritionReport(
  logs: DayLog[],
  target: NutritionTarget | null,
  windowDays = 14
): NutritionReport {
  const now = new Date()
  const generatedAt = now.toISOString()
  const windowStart = new Date(now.getTime() - windowDays * 86_400_000)

  const inWindow = logs.filter((l) => new Date(l.date) >= windowStart)

  if (inWindow.length < MIN_DAYS) {
    return { status: 'insufficient_data', generatedAt, data: null }
  }

  const n = inWindow.length
  const avg = (key: keyof DayLog) =>
    Math.round(inWindow.reduce((s, l) => s + (l[key] as number), 0) / n)

  const averageKcal = avg('kcal')
  const averageProtein = avg('protein')
  const averageCarbs = avg('carbs')
  const averageFat = avg('fat')

  // Adherence: % days within ±15% of target
  let adherence: MacroAdherence | null = null
  let trend: NutritionReportData['trend'] = null

  if (target) {
    const withinRange = (val: number, tgt: number) =>
      Math.abs(val - tgt) / tgt <= 0.15

    const calDays = inWindow.filter((l) => withinRange(l.kcal, target.calories)).length
    const proteinDays = inWindow.filter((l) => withinRange(l.protein, target.protein)).length

    adherence = {
      calorieAdherence: Math.round((calDays / n) * 100),
      proteinAdherence: Math.round((proteinDays / n) * 100),
    }

    // Trend vs target: based on avg kcal vs target
    const ratio = averageKcal / target.calories
    if (ratio >= 0.9 && ratio <= 1.1) trend = 'on_track'
    else if (ratio < 0.9) trend = 'under'
    else trend = 'over'
  }

  return {
    status: 'ok',
    generatedAt,
    data: { daysLogged: n, averageKcal, averageProtein, averageCarbs, averageFat, adherence, trend },
  }
}
