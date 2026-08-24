import { describe, expect, it } from 'vitest'
import type { HistoryIncident } from '../components/HistoryStrip'
import { trackRecordSummary } from '../components/RiskVerdict'

function incident(usdLost: number, usdRecovered: number | null): HistoryIncident {
	return { date: '2025-01-01', title: 'Incident', usdLost, usdRecovered }
}

describe('trackRecordSummary', () => {
	it('distinguishes unavailable recovery from explicit zero recovery', () => {
		expect(trackRecordSummary([incident(1_000, null)]).detail).toBe('1 incident, recovery unavailable')
		expect(trackRecordSummary([incident(1_000, 0)]).detail).toBe('1 incident, not recovered')
	})

	it('reports known recovery without claiming mixed records are complete', () => {
		const summary = trackRecordSummary([incident(1_000, 1_000), incident(2_000, null)])

		expect(summary.label).toContain('3,000')
		expect(summary.detail).toBe('2 incidents, $1,000 recovered, recovery unavailable')
		expect(summary.label).not.toContain('made whole')
	})

	it('only marks fully known recovery as made whole', () => {
		expect(trackRecordSummary([incident(1_000, 1_000)])).toMatchObject({
			label: '1 incident · made whole',
			tone: 'good',
			detail: null
		})
	})
})
