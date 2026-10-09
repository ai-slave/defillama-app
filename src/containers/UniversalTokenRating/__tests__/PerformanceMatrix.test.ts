import { describe, expect, test } from 'vitest'
import { buildMatrixPoints, formatMatrixTooltip } from '../PerformanceMatrix'
import { areMatrixIconsReady } from '../performanceMatrixIcons'
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

describe('performance matrix', () => {
	test('colors points and tooltip bars from runtime grade thresholds', () => {
		const unclaimed = { ...row(null), claimed: false }

		expect(buildMatrixPoints([unclaimed], {}, grading)[0]!.itemStyle!.color).toBe('#11935f')
		const tooltip = formatMatrixTooltip(unclaimed, grading)
		expect(tooltip).toContain('#11935f')
		expect(tooltip).toContain('#b23a38')
		expect(tooltip).toContain('/universal-token-rating/claim?token=example')
	})

	test('uses an explicit API grade before deriving from the score', () => {
		expect(buildMatrixPoints([row('B')], {}, grading)[0]!.itemStyle!.color).toBe('#b96d39')
	})

	test('uses neutral colors when scoring configuration and explicit grades are unavailable', () => {
		expect(buildMatrixPoints([row(null)], {}, null)[0]!.itemStyle!.color).toBe('#8a8a8a')
	})

	test('waits for every available token icon before the first chart render', () => {
		const withIcon = { ...row(null), iconDataUrl: 'data:image/png;base64,example' }

		expect(areMatrixIconsReady([withIcon], {})).toBe(false)
		expect(areMatrixIconsReady([withIcon], { example: 'data:image/png;base64,rounded' })).toBe(true)
		expect(areMatrixIconsReady([withIcon], { example: null })).toBe(true)
	})

	test('renders a resolved icon instead of the temporary circle fallback', () => {
		const points = buildMatrixPoints([row(null)], { example: 'data:image/png;base64,rounded' }, grading)

		expect(points[0]!.symbol).toBe('image://data:image/png;base64,rounded')
	})
})
