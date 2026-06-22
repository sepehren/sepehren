import { describe, it, expect } from 'vitest'
import { buildWorkoutReport } from '../reports/workout'
import { buildNutritionReport } from '../reports/nutrition'
import { buildProgressReport } from '../reports/progress'
import { buildRiskReport } from '../reports/risk'

// ── Helpers ────────────────────────────────────────────────────────────────

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 86_400_000)
}

// ── Workout report ─────────────────────────────────────────────────────────

describe('buildWorkoutReport', () => {
  it('returns insufficient_data with fewer than 2 sessions', () => {
    const result = buildWorkoutReport([
      { id: '1', completedAt: daysAgo(1), rating: 4, painFlag: false, planName: 'P', dayName: 'D1' },
    ], 0)
    expect(result.status).toBe('insufficient_data')
    expect(result.data).toBeNull()
  })

  it('returns ok with 2+ sessions', () => {
    const sessions = [
      { id: '1', completedAt: daysAgo(5), rating: 4, painFlag: false, planName: 'P', dayName: 'D1' },
      { id: '2', completedAt: daysAgo(2), rating: 5, painFlag: false, planName: 'P', dayName: 'D2' },
    ]
    const result = buildWorkoutReport(sessions, 0)
    expect(result.status).toBe('ok')
    expect(result.data?.totalCompleted).toBe(2)
    expect(result.data?.averageRating).toBe(4.5)
    expect(result.data?.painFlagCount).toBe(0)
  })

  it('calculates completion rate correctly', () => {
    const sessions = Array.from({ length: 3 }, (_, i) => ({
      id: String(i), completedAt: daysAgo(i + 1), rating: 3,
      painFlag: false, planName: 'P', dayName: 'D',
    }))
    const result = buildWorkoutReport(sessions, 1) // 3 completed, 1 skipped
    expect(result.data?.completionRate).toBe(75)
  })

  it('reports improving trend when second-half ratings are higher', () => {
    const sessions = [
      { id: '1', completedAt: daysAgo(20), rating: 2, painFlag: false, planName: 'P', dayName: 'D' },
      { id: '2', completedAt: daysAgo(15), rating: 2, painFlag: false, planName: 'P', dayName: 'D' },
      { id: '3', completedAt: daysAgo(5), rating: 5, painFlag: false, planName: 'P', dayName: 'D' },
      { id: '4', completedAt: daysAgo(2), rating: 5, painFlag: false, planName: 'P', dayName: 'D' },
    ]
    const result = buildWorkoutReport(sessions, 0)
    expect(result.data?.trend).toBe('improving')
  })

  it('ignores sessions outside the window and returns insufficient_data if only 1 remains', () => {
    const sessions = [
      { id: '1', completedAt: daysAgo(45), rating: 5, painFlag: false, planName: 'P', dayName: 'D' },
      { id: '2', completedAt: daysAgo(5), rating: 3, painFlag: false, planName: 'P', dayName: 'D' },
    ]
    const result = buildWorkoutReport(sessions, 0, 30)
    // Only 1 session in the 30-day window → insufficient_data
    expect(result.status).toBe('insufficient_data')
  })
})

// ── Nutrition report ───────────────────────────────────────────────────────

describe('buildNutritionReport', () => {
  it('returns insufficient_data with fewer than 3 day-logs', () => {
    const result = buildNutritionReport([
      { date: '2026-06-20', kcal: 2000, protein: 150, carbs: 200, fat: 70 },
    ], null)
    expect(result.status).toBe('insufficient_data')
  })

  it('computes averages and on_track trend', () => {
    const logs = Array.from({ length: 5 }, (_, i) => ({
      date: new Date(Date.now() - (i + 1) * 86_400_000).toISOString().split('T')[0],
      kcal: 2000, protein: 150, carbs: 200, fat: 70,
    }))
    const target = { calories: 2000, protein: 150, carbs: 200, fat: 70 }
    const result = buildNutritionReport(logs, target)
    expect(result.status).toBe('ok')
    expect(result.data?.averageKcal).toBe(2000)
    expect(result.data?.trend).toBe('on_track')
    expect(result.data?.adherence?.calorieAdherence).toBe(100)
  })

  it('detects under-eating', () => {
    const logs = Array.from({ length: 4 }, (_, i) => ({
      date: new Date(Date.now() - (i + 1) * 86_400_000).toISOString().split('T')[0],
      kcal: 1200, protein: 100, carbs: 120, fat: 50,
    }))
    const result = buildNutritionReport(logs, { calories: 2000, protein: 150, carbs: 200, fat: 70 })
    expect(result.data?.trend).toBe('under')
  })
})

// ── Progress report ────────────────────────────────────────────────────────

describe('buildProgressReport', () => {
  it('returns insufficient_data with fewer than 2 entries', () => {
    const result = buildProgressReport([
      { id: '1', recordedAt: daysAgo(5), weightKg: 80, measurements: null },
    ])
    expect(result.status).toBe('insufficient_data')
  })

  it('calculates weight loss correctly', () => {
    const result = buildProgressReport([
      { id: '1', recordedAt: daysAgo(30), weightKg: 85, measurements: { waist: 90 } },
      { id: '2', recordedAt: daysAgo(5), weightKg: 83, measurements: { waist: 87 } },
    ])
    expect(result.status).toBe('ok')
    expect(result.data?.weightChangeKg).toBe(-2)
    expect(result.data?.weightTrend).toBe('losing')
    expect(result.data?.measurementDeltas?.waist).toBe(-3)
  })

  it('marks stable when weight change < 0.5kg', () => {
    const result = buildProgressReport([
      { id: '1', recordedAt: daysAgo(20), weightKg: 80.2, measurements: null },
      { id: '2', recordedAt: daysAgo(5), weightKg: 80.4, measurements: null },
    ])
    expect(result.data?.weightTrend).toBe('stable')
  })
})

// ── Risk report ────────────────────────────────────────────────────────────

describe('buildRiskReport', () => {
  const healthyCheckIn = { energy: 4, soreness: 2, stress: 2, sleep: 4, confidence: 4, submittedAt: daysAgo(1) }

  it('returns insufficient_data without pain flag and fewer than 3 check-ins', () => {
    const result = buildRiskReport([healthyCheckIn], false, 'athlete1')
    expect(result.status).toBe('insufficient_data')
  })

  it('returns ok immediately with a pain flag even without check-ins', () => {
    const result = buildRiskReport([], true, 'athlete1')
    expect(result.status).toBe('ok')
    expect(result.data?.flags[0].signal).toMatch(/Pain/)
    expect(result.data?.riskLevel).toBe('moderate')
  })

  it('returns low risk for consistently healthy signals', () => {
    const checkIns = Array.from({ length: 5 }, (_, i) => ({
      ...healthyCheckIn, submittedAt: daysAgo(i + 1),
    }))
    const result = buildRiskReport(checkIns, false, 'athlete1')
    expect(result.data?.riskLevel).toBe('low')
    expect(result.data?.flags).toHaveLength(0)
  })

  it('flags high soreness and elevates risk', () => {
    const checkIns = Array.from({ length: 4 }, (_, i) => ({
      energy: 3, soreness: 5, stress: 2, sleep: 3, confidence: 3, submittedAt: daysAgo(i + 1),
    }))
    const result = buildRiskReport(checkIns, false, 'athlete1')
    expect(result.data?.flags.some((f) => f.signal.match(/soreness/i))).toBe(true)
    expect(result.data?.riskLevel).toBe('moderate')
  })

  it('high risk when 3+ flags present', () => {
    const checkIns = Array.from({ length: 4 }, (_, i) => ({
      energy: 1, soreness: 5, stress: 5, sleep: 1, confidence: 2, submittedAt: daysAgo(i + 1),
    }))
    const result = buildRiskReport(checkIns, true, 'athlete1')
    expect(result.data?.riskLevel).toBe('high')
  })

  it('action links include athleteId', () => {
    const checkIns = Array.from({ length: 4 }, (_, i) => ({
      energy: 1, soreness: 1, stress: 1, sleep: 1, confidence: 1, submittedAt: daysAgo(i + 1),
    }))
    const result = buildRiskReport(checkIns, false, 'athlete-xyz')
    const links = result.data?.flags.map((f) => f.actionLink) ?? []
    expect(links.every((l) => l.includes('athlete-xyz'))).toBe(true)
  })
})
