// Shared types for all report modules.
// Every report returns a status so callers never render invented data.

export type ReportStatus = 'ok' | 'insufficient_data'

export interface ReportBase {
  status: ReportStatus
  generatedAt: string // ISO timestamp
}
