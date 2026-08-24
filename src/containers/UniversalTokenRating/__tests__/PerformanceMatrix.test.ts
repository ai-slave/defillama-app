import { describe, expect, it } from 'vitest'
import { buildMatrixOption } from '../PerformanceMatrix'
import type { UtrGradingConfig, UtrLeaderboardRow } from '../types'

const grading: UtrGradingConfig = {
	overall: {
		description: '',
		scale: [
			{ min: 60, grade: 'AAA', interpretation: '' },
			{ min: 40, grade: 'AA', interpretation: '' },
			{ min: null, grade: 'CCC', interpretation: '' }
		]
	},
	disclosure: {
		description: '',
		scale: [
			{ min: 8, grade: 'AAA', interpretation: '' },
			{ min: null, grade: 'CCC', interpretation: '' }
		]
	},
	performance: {
		description: '',
		scale: [
			{ min: 8, grade: 'AAA', interpretation: '' },
			{ min: null, grade: 'CCC', interpretation: '' }
		]
	}
}

function row(grade?: string | null): UtrLeaderboardRow {
	return {
		asset: 'example',
		name: 'Example',
		symbol: 'EXP',
		sector: null,
		listingStatus: 'listed',
		disclosureLevel: 'full',
		claimed: true,
		fdvUsd: null,
		grade,
		scores: {
			overall: 60,
			overallMomChangePct: null,
			disclosure: 8,
			performance: 7,
			rank: 1,
			disclosureRubrics: [],
			performanceRubrics: []
		}
	}
}

describe('buildMatrixOption', () => {
	it('colors points and tooltip bars from runtime grade thresholds', () => {
		const option = buildMatrixOption([row(null)], undefined, {}, false, grading) as any

		expect(option.series[0].data[0].itemStyle.color).toBe('#11935f')
		const tooltip = option.tooltip.formatter({ dataIndex: 0 })
		expect(tooltip).toContain('#11935f')
		expect(tooltip).toContain('#b23a38')
	})

	it('uses an explicit API grade before deriving from the score', () => {
		const option = buildMatrixOption([row('B')], undefined, {}, false, grading) as any

		expect(option.series[0].data[0].itemStyle.color).toBe('#b96d39')
	})

	it('uses neutral colors when scoring configuration and explicit grades are unavailable', () => {
		const option = buildMatrixOption([row(null)], undefined, {}, false, null) as any

		expect(option.series[0].data[0].itemStyle.color).toBe('#8a8a8a')
	})
})
