// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { buildHacksPageSummary } from '../data'
import { HacksContainer } from '../index'
import type { IHackRow } from '../types'

const router = vi.hoisted(() => ({
	pathname: '/hacks',
	asPath: '/hacks',
	query: {} as Record<string, string | Array<string>>,
	push: vi.fn()
}))
vi.mock('next/router', () => ({ useRouter: () => router }))
// The charts load lazily and draw nothing this test reads.
vi.mock('~/components/ECharts/PieChart', () => ({ default: () => null }))
vi.mock('~/components/ECharts/MultiSeriesChart', () => ({ default: () => null }))

const hack = (name: string, chains: Array<string>): IHackRow => ({
	name,
	chains,
	classification: 'Protocol Logic',
	technique: 'Key Compromise',
	date: 1_704_067_200,
	target: 'DeFi Protocol',
	amountUsd: 1000,
	bridge: false,
	language: ''
})
const DATA = [hack('Ethereum hack', ['Ethereum']), hack('Base hack', ['Base'])]

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

test('Reset filters clears a chain the user deselected', async () => {
	router.query = { excludeChain: 'Base' }
	await act(async () => root.render(<HacksContainer data={DATA} {...buildHacksPageSummary(DATA)} />))

	const reset = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Reset filters')!
	expect(reset.disabled).toBe(false)

	await act(async () => reset.click())
	expect(router.push.mock.lastCall?.[0].query).toEqual({})
})
