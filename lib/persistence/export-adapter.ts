import { type PracticeSessionRecord } from '../persistence/storage-types'

/**
 * DataExportAdapter
 *
 * Provides functionality to export session history to standard formats.
 */
export class DataExportAdapter {
  /**
   * Exports sessions as a JSON blob and triggers a download.
   */
  exportToJson(sessions: PracticeSessionRecord[]): void {
    const dataStr = JSON.stringify(sessions, null, 2)
    const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`
    this.triggerDownload(dataUri, `violin_mentor_export_${Date.now()}.json`)
  }

  /**
   * Exports sessions as a CSV blob and triggers a download.
   */
  exportToCsv(sessions: PracticeSessionRecord[]): void {
    if (sessions.length === 0) return

    const headers = ['id', 'exerciseId', 'timestamp', 'score', 'accuracyPercentage', 'mostDifficultNote', 'durationSeconds']
    const csvRows = [
      headers.join(','),
      ...sessions.map(s => [
        s.id,
        s.exerciseId,
        new Date(s.timestamp).toISOString(),
        s.score,
        s.accuracyPercentage,
        s.mostDifficultNote ?? '',
        s.durationSeconds
      ].join(','))
    ]

    const csvStr = csvRows.join('\n')
    const dataUri = `data:text/csv;charset=utf-8,${encodeURIComponent(csvStr)}`
    this.triggerDownload(dataUri, `violin_mentor_export_${Date.now()}.csv`)
  }

  private triggerDownload(uri: string, filename: string): void {
    if (typeof window === 'undefined') return

    const linkElement = document.createElement('a')
    linkElement.setAttribute('href', uri)
    linkElement.setAttribute('download', filename)
    linkElement.click()
    linkElement.remove()
  }
}

export const dataExportAdapter = new DataExportAdapter()
