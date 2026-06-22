import { describe, it, expect } from 'vitest'
import { computePriority } from '../priority'

const base = {
  painFlag: false,
  unreviewedCheckIns: 0,
  overdueCheckIns: 0,
  unreadMessages: 0,
  lowEnergyStreak: 0,
  highSorenessStreak: 0,
  lastRating: null,
  lastSessionDaysAgo: null,
}

describe('computePriority', () => {
  it('returns score 0 and no reasons for a clean athlete', () => {
    const result = computePriority(base)
    expect(result.score).toBe(0)
    expect(result.reasons).toHaveLength(0)
    expect(result.action).toBe('Check in')
  })

  it('pain flag gives score 100 and tops the queue action', () => {
    const result = computePriority({ ...base, painFlag: true, planName: 'Block 1', painLocation: 'knee' })
    expect(result.score).toBe(100)
    expect(result.reasons[0]).toMatch(/pain/i)
    expect(result.reasons[0]).toMatch(/knee/)
    expect(result.action).toBe('Review pain report')
  })

  it('pain flag contributes 100 points regardless of other signals', () => {
    const withoutPain = computePriority({
      ...base,
      unreviewedCheckIns: 5,
      overdueCheckIns: 3,
      unreadMessages: 10,
      lastRating: 1,
      lowEnergyStreak: 3,
      highSorenessStreak: 3,
      lastSessionDaysAgo: 10,
    })
    const withPain = computePriority({
      ...base,
      painFlag: true,
      unreviewedCheckIns: 5,
      overdueCheckIns: 3,
      unreadMessages: 10,
      lastRating: 1,
      lowEnergyStreak: 3,
      highSorenessStreak: 3,
      lastSessionDaysAgo: 10,
    })
    expect(withPain.score).toBe(withoutPain.score + 100)
  })

  it('low rating 1 adds 40 points and sets action to adjust plan', () => {
    const result = computePriority({ ...base, lastRating: 1 })
    expect(result.score).toBe(40)
    expect(result.reasons[0]).toMatch(/rated 1\/5/)
    expect(result.action).toBe('Adjust plan')
  })

  it('rating 3 adds 10 points but no reason string', () => {
    const result = computePriority({ ...base, lastRating: 3 })
    expect(result.score).toBe(10)
    expect(result.reasons).toHaveLength(0)
  })

  it('unreviewed check-ins score 15 each', () => {
    const result = computePriority({ ...base, unreviewedCheckIns: 3 })
    expect(result.score).toBe(45)
    expect(result.reasons[0]).toMatch(/3 unreviewed/)
    expect(result.action).toBe('Review check-in')
  })

  it('overdue check-ins score 20 each and set action', () => {
    const result = computePriority({ ...base, overdueCheckIns: 2 })
    expect(result.score).toBe(40)
    expect(result.action).toBe('Follow up on overdue check-in')
  })

  it('unread messages capped at 25', () => {
    const result = computePriority({ ...base, unreadMessages: 100 })
    expect(result.score).toBe(25)
    expect(result.action).toBe('Reply to message')
  })

  it('low energy streak ≥ 3 adds 30 points', () => {
    const result = computePriority({ ...base, lowEnergyStreak: 3 })
    expect(result.score).toBe(30)
    expect(result.reasons[0]).toMatch(/Low energy 3/)
    expect(result.action).toBe('Review load')
  })

  it('no session in 7 days adds 20 points', () => {
    const result = computePriority({ ...base, lastSessionDaysAgo: 7 })
    expect(result.score).toBe(20)
    expect(result.reasons[0]).toMatch(/7 days/)
  })

  it('no session in 6 days adds nothing', () => {
    const result = computePriority({ ...base, lastSessionDaysAgo: 6 })
    expect(result.score).toBe(0)
  })

  it('scores are additive', () => {
    const result = computePriority({
      ...base,
      painFlag: true,       // 100
      lastRating: 1,        // 40
      unreviewedCheckIns: 1, // 15
    })
    expect(result.score).toBe(155)
  })
})
