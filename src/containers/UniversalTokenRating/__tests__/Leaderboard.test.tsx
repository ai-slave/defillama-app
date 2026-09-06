import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'
import type { UtrGradingConfig, UtrLeaderboardRow } from '../types'

vi.mock('../PerformanceMatrix', () => ({
	PerformanceMatrix: () => <div>Matrix</div>
}))

import { Leaderboard, LEADERBOARD_COLUMN_COUNT } from '../Leaderboard'
import { pageForUtrAsset } from '../navigation'

const grading: UtrGradingConfig = {
	overall: {
		description: '',
		scale: [
			{ min: 60, grade: 'AAA', interpretation: 'Highest confidence' },
			{ min: null, grade: 'CCC', interpretation: 'Very low confidence' }
		]
	},
	disclosure: {
		description: '',
		scale: [
			{ min: 8, grade: 'AAA', interpretation: 'Exceptional' },
			{ min: null, grade: 'CCC', interpretation: 'Insufficient' }
		]
	},
	performance: {
		description: '',
		scale: [
			{ min: 8, grade: 'AAA', interpretation: 'Exceptional' },
			{ min: null, grade: 'CCC', interpretation: 'Insufficient' }
		]
	}
}

const row: UtrLeaderboardRow = {
	asset: 'example',
	name: 'Example Protocol',
	symbol: 'EXP',
	sector: 'DeFi',
	listingStatus: 'listed',
	disclosureLevel: 'full',
	claimed: false,
	fdvUsd: 10_000_000,
	grade: 'AAA',
	scores: {
		overall: 60,
		overallMomChangePct: 2,
		disclosure: 8,
		performance: 7.5,
		rank: 1,
		disclosureRubrics: [],
		performanceRubrics: []
	}
}

describe('Leaderboard', () => {
	test('returns the page that contains a searched asset', () => {
		const rows = Array.from({ length: 205 }, (_, index) => ({ ...row, asset: `asset-${index}` }))
		expect(pageForUtrAsset(rows, 'asset-0')).toBe(0)
		expect(pageForUtrAsset(rows, 'asset-100')).toBe(1)
		expect(pageForUtrAsset(rows, 'asset-204')).toBe(2)
		expect(pageForUtrAsset(rows, 'missing')).toBeNull()
	})

	test('renders the API grade after Protocol without a Status or pin column', () => {
		const html = renderToStaticMarkup(
			<Leaderboard rows={[row]} grading={grading} sort={{ key: 'rank', desc: false }} setSort={() => undefined} />
		)

		expect(html.indexOf('Protocol')).toBeLessThan(html.indexOf('Grade'))
		expect(html).toContain('AAA')
		expect(html).toContain('bg-utr-grade-aaa')
		expect(html).not.toContain('Status')
		expect(html).not.toContain('Pin My Token')
		expect(LEADERBOARD_COLUMN_COUNT).toBe(8)
	})
})
