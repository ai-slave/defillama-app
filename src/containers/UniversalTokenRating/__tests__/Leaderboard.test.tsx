// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, test, vi } from 'vitest'
import type { UtrGradingConfig, UtrLeaderboardRow } from '../types'

vi.mock('../PerformanceMatrix', () => ({
	PerformanceMatrix: () => <div>Matrix</div>
}))

import { Leaderboard } from '../Leaderboard'
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

let root: Root | undefined
let container: HTMLDivElement | undefined
afterEach(async () => {
	await act(async () => root?.unmount())
	root = undefined
	container?.remove()
})

describe('Leaderboard', () => {
	test('returns the page that contains a searched asset', () => {
		const rows = Array.from({ length: 205 }, (_, index) => ({ ...row, asset: `asset-${index}` }))
		expect(pageForUtrAsset(rows, 'asset-0')).toBe(0)
		expect(pageForUtrAsset(rows, 'asset-100')).toBe(1)
		expect(pageForUtrAsset(rows, 'asset-204')).toBe(2)
		expect(pageForUtrAsset(rows, 'missing')).toBeNull()
	})

	test('uses the API grade and spans every column when a row expands', async () => {
		container = document.createElement('div')
		document.body.append(container)
		root = createRoot(container)
		await act(async () =>
			root!.render(
				<Leaderboard
					rows={[{ ...row, grade: 'CCC' }]}
					grading={grading}
					sort={{ key: 'rank', desc: false }}
					setSort={() => undefined}
					fdvRanges={[]}
					sectors={[]}
					listingStatuses={[]}
				/>
			)
		)

		const headers = [...container.querySelectorAll('thead th')]
		const labels = headers.map((header) => header.textContent?.trim())
		const gradeIndex = labels.indexOf('Grade')
		expect(gradeIndex).toBeGreaterThan(-1)
		expect(labels[gradeIndex - 1]).toBe('Protocol')
		// The score maps to AAA; the API's explicit CCC grade must take precedence.
		expect(container.querySelector('tbody tr')!.children[gradeIndex].textContent).toBe('CCC')
		expect(labels).not.toContain('Status')
		expect(container.textContent).not.toContain('Pin My Token')
		await act(async () => container!.querySelector<HTMLButtonElement>('button[aria-label="Expand row"]')!.click())
		expect(container.querySelector<HTMLTableCellElement>('td[colspan]')!.colSpan).toBe(headers.length)
		await act(async () => container!.querySelector<HTMLButtonElement>('button[aria-label="Collapse row"]')!.click())
		expect(container.querySelector('td[colspan]')).toBeNull()
	})
})
