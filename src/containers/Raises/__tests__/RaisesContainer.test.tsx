// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import RaisesContainer from '../index'
import type { Raise } from '../model'
import { getRaisesFiltersList } from '../utils'

const router = vi.hoisted(() => ({
	pathname: '/raises',
	asPath: '/raises',
	query: {} as Record<string, string | Array<string>>,
	push: vi.fn()
}))
vi.mock('next/router', () => ({ useRouter: () => router }))
// The chart loads lazily and draws nothing this test reads.
vi.mock('~/components/ECharts/MultiSeriesChart', () => ({ default: () => null }))

const raise = (name: string, chains: Array<string>): Raise => ({
	name,
	amountUsd: 1000,
	date: 1_737_331_200,
	round: 'Seed',
	chains,
	sector: null,
	category: 'DeFi',
	categoryGroup: 'DeFi',
	leadInvestors: ['Fund'],
	otherInvestors: [],
	valuationUsd: null,
	source: ''
})
const RAISES = [raise('On Ethereum', ['Ethereum']), raise('On Base', ['Base'])]

let container: HTMLDivElement
let root: Root

beforeEach(() => {
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	router.query = {}
	router.push.mockClear()
})

test('Reset all filters clears a chain the user deselected', async () => {
	router.query = { excludeChain: 'Base' }
	await act(async () =>
		root.render(<RaisesContainer raises={RAISES} investorName={null} {...getRaisesFiltersList({ raises: RAISES })} />)
	)

	const reset = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Reset all filters')!
	expect(reset.disabled).toBe(false)

	await act(async () => reset.click())
	expect(router.push.mock.lastCall?.[0].query).toEqual({})
})
