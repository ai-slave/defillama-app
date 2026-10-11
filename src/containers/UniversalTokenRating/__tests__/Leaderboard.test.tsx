// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { installChartCanvas } from '~/utils/testing/chartCanvas'
import { Leaderboard } from '../Leaderboard'
import { pageForUtrAsset, type UtrFocusRequest } from '../navigation'
import type { UtrGradingConfig, UtrLeaderboardRow } from '../types'

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
// The leaderboard draws the performance matrix, a real ECharts scatter that needs a canvas.
beforeEach(() => installChartCanvas())

afterEach(async () => {
	vi.restoreAllMocks()
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

	test('uses the API grade and reveals the score breakdown on expansion', async () => {
		container = document.createElement('div')
		document.body.append(container)
		root = createRoot(container)
		// An expanded row draws its matrix, which loads the token's logo through the query client.
		await act(async () =>
			root!.render(
				<QueryClientProvider client={new QueryClient()}>
					<Leaderboard
						rows={[{ ...row, grade: 'CCC' }]}
						grading={grading}
						sort={{ key: 'rank', desc: false }}
						setSort={() => undefined}
						fdvRanges={[]}
						sectors={[]}
						listingStatuses={[]}
					/>
				</QueryClientProvider>
			)
		)

		const headers = [...container.querySelectorAll('thead th')]
		const labels = headers.map((header) => header.textContent?.trim())
		const gradeIndex = labels.indexOf('Grade')
		expect(gradeIndex).toBeGreaterThan(-1)
		// The score maps to AAA; the API's explicit CCC grade must take precedence.
		expect(container.querySelector('tbody tr')!.children[gradeIndex].textContent).toBe('CCC')
		const details = container.querySelector<HTMLButtonElement>('button[aria-label="Row details"]')!
		await act(async () => details.click())
		expect(details.getAttribute('aria-expanded')).toBe('true')
		expect(container.textContent).toContain('Disclosures: breakdown by category')
		await act(async () => details.click())
		expect(details.getAttribute('aria-expanded')).toBe('false')
		expect(container.textContent).not.toContain('Disclosures: breakdown by category')
	})

	test('pages to a searched token and lets the reader page onward', async () => {
		container = document.createElement('div')
		document.body.append(container)
		root = createRoot(container)
		const rows = Array.from({ length: 205 }, (_, index) => ({
			...row,
			asset: `asset-${index}`,
			name: `Protocol ${index}`,
			scores: { ...row.scores, rank: index }
		}))
		const render = (focusRequest?: UtrFocusRequest) =>
			act(async () =>
				root!.render(
					<Leaderboard
						rows={rows}
						sort={{ key: 'rank', desc: false }}
						setSort={() => undefined}
						fdvRanges={[]}
						sectors={[]}
						listingStatuses={[]}
						focusRequest={focusRequest}
					/>
				)
			)
		const onPage = (asset: string) => document.getElementById(`utr-row-${asset}`) != null

		await render()
		expect(onPage('asset-0')).toBe(true)
		await render({ asset: 'asset-150', nonce: 1 })
		expect(onPage('asset-150')).toBe(true)
		expect(onPage('asset-0')).toBe(false)
		await act(async () => container!.querySelector<HTMLButtonElement>('[aria-label="Go to next page"]')!.click())
		expect(onPage('asset-204')).toBe(true)
		expect(container.textContent).toContain('Page 3 of 3')
	})
})
