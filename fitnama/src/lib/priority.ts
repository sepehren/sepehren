// Pure priority scorer — no DB calls, fully testable.
// Input: athlete signals. Output: { score, reasons, action }.

export interface PrioritySignals {
  painFlag: boolean
  painLocation?: string | null
  planName?: string | null
  lastRating?: number | null       // 1–5
  unreviewedCheckIns: number
  overdueCheckIns: number
  unreadMessages: number
  lastSessionDaysAgo?: number | null
  lowEnergyStreak: number          // consecutive check-ins with energy ≤ 2
  highSorenessStreak: number       // consecutive check-ins with soreness ≥ 4
}

export interface PriorityResult {
  score: number
  reasons: string[]
  action: string
}

export function computePriority(signals: PrioritySignals): PriorityResult {
  let score = 0
  const reasons: string[] = []

  // Pain flag — highest weight; always surfaces first
  if (signals.painFlag) {
    score += 100
    const location = signals.painLocation ? ` in ${signals.painLocation}` : ''
    const plan = signals.planName ? ` during "${signals.planName}"` : ''
    reasons.push(`Reported pain${location}${plan}`)
  }

  // Very low session rating
  if (signals.lastRating !== null && signals.lastRating !== undefined) {
    if (signals.lastRating <= 2) {
      score += 40
      reasons.push(`Last session rated ${signals.lastRating}/5`)
    } else if (signals.lastRating === 3) {
      score += 10
    }
  }

  // Unreviewed check-ins
  if (signals.unreviewedCheckIns > 0) {
    score += signals.unreviewedCheckIns * 15
    reasons.push(`${signals.unreviewedCheckIns} unreviewed check-in${signals.unreviewedCheckIns > 1 ? 's' : ''}`)
  }

  // Overdue check-ins
  if (signals.overdueCheckIns > 0) {
    score += signals.overdueCheckIns * 20
    reasons.push(`${signals.overdueCheckIns} overdue check-in${signals.overdueCheckIns > 1 ? 's' : ''}`)
  }

  // Unread messages
  if (signals.unreadMessages > 0) {
    score += Math.min(signals.unreadMessages * 5, 25)
    reasons.push(`${signals.unreadMessages} unread message${signals.unreadMessages > 1 ? 's' : ''}`)
  }

  // Consecutive low energy
  if (signals.lowEnergyStreak >= 3) {
    score += 30
    reasons.push(`Low energy ${signals.lowEnergyStreak} check-ins in a row`)
  } else if (signals.lowEnergyStreak === 2) {
    score += 15
  }

  // Consecutive high soreness
  if (signals.highSorenessStreak >= 3) {
    score += 25
    reasons.push(`High soreness ${signals.highSorenessStreak} check-ins in a row`)
  } else if (signals.highSorenessStreak === 2) {
    score += 10
  }

  // Gone quiet — no session in a while
  if (signals.lastSessionDaysAgo !== null && signals.lastSessionDaysAgo !== undefined) {
    if (signals.lastSessionDaysAgo >= 7) {
      score += 20
      reasons.push(`No session in ${signals.lastSessionDaysAgo} days`)
    }
  }

  // Derive the single most-important action
  let action = 'Check in'
  if (signals.painFlag) action = 'Review pain report'
  else if (signals.overdueCheckIns > 0) action = 'Follow up on overdue check-in'
  else if (signals.unreviewedCheckIns > 0) action = 'Review check-in'
  else if (signals.lastRating !== null && signals.lastRating !== undefined && signals.lastRating <= 2) action = 'Adjust plan'
  else if (signals.unreadMessages > 0) action = 'Reply to message'
  else if (signals.lowEnergyStreak >= 2 || signals.highSorenessStreak >= 2) action = 'Review load'

  return { score, reasons, action }
}
