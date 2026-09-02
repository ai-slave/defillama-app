import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { buildMatrixOption, PerformanceMatrix } from '../PerformanceMatrix'
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

describe('buildMatrixOption', () => {
	it('colors points and tooltip bars from runtime grade thresholds', () => {
		const option = buildMatrixOption([{ ...row(null), claimed: false }], undefined, {}, false, grading) as any

		expect(option.animation).toBe(false)
		expect(option.series[0].data[0].itemStyle.color).toBe('#11935f')
		const tooltip = option.tooltip.formatter({ dataIndex: 0 })
		expect(tooltip).toContain('#11935f')
		expect(tooltip).toContain('#b23a38')
		expect(tooltip).toContain('/universal-token-rating/claim?token=example')
	})

	it('uses an explicit API grade before deriving from the score', () => {
		const option = buildMatrixOption([row('B')], undefined, {}, false, grading) as any

		expect(option.series[0].data[0].itemStyle.color).toBe('#b96d39')
	})

	it('uses neutral colors when scoring configuration and explicit grades are unavailable', () => {
		const option = buildMatrixOption([row(null)], undefined, {}, false, null) as any

		expect(option.series[0].data[0].itemStyle.color).toBe('#8a8a8a')
	})

	it('waits for every available token icon before the first chart render', () => {
		const withIcon = { ...row(null), iconDataUrl: 'data:image/png;base64,example' }

		expect(areMatrixIconsReady([withIcon], {})).toBe(false)
		expect(areMatrixIconsReady([withIcon], { example: 'data:image/png;base64,rounded' })).toBe(true)
		expect(areMatrixIconsReady([withIcon], { example: null })).toBe(true)
	})

	it('renders a resolved icon instead of the temporary circle fallback', () => {
		const option = buildMatrixOption(
			[row(null)],
			undefined,
			{ example: 'data:image/png;base64,rounded' },
			false,
			grading
		) as any

		expect(option.series[0].data[0].symbol).toBe('image://data:image/png;base64,rounded')
	})

	it('shows an accessible loading state until the chart is ready', () => {
		const html = renderToStaticMarkup(createElement(PerformanceMatrix, { rows: [row(null)], grading }))

		expect(html).toContain('role="status"')
		expect(html).toContain('Loading chart')
		expect(html).toContain('invisible')
		expect(html).toContain('h-[494px]')
	})
})
