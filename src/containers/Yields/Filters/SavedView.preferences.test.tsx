// @vitest-environment happy-dom

import { Storage } from 'happy-dom'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { APY_COMPONENTS_PREF, APY_WINDOW_PREF, TABLE_PAGE_SIZE_PREF } from '../stickyQueryPrefs'
import { useLegacyYieldsUrlNormalizer } from '../useLegacyYieldsUrlNormalizer'
import { YieldFilters } from './index'

type Query = Record<string, string | Array<string> | undefined>
const state = vi.hoisted(() => ({
	savedFilters: {} as Record<string, Record<string, unknown>>,
	router: {
		pathname: '/yields',
		query: {} as Query,
		isReady: true,
		push: vi.fn().mockResolvedValue(true),
		replace: vi.fn().mockResolvedValue(true),
		events: { on: vi.fn(), off: vi.fn() }
	}
}))
vi.mock('next/router', () => ({ useRouter: () => state.router }))
vi.mock('~/contexts/LocalStorage', () => ({
	useYieldFilters: () => ({ savedFilters: state.savedFilters, saveFilter: vi.fn(), deleteFilter: vi.fn() })
}))
vi.mock('~/components/CsvDownloadButton', () => ({ CSVDownloadButton: () => null }))
vi.mock('~/components/Filters/ResponsiveFilterLayout', () => ({ ResponsiveFilterLayout: () => null }))
vi.mock('./Dropdowns', () => ({ YieldFilterDropdowns: () => null }))
vi.mock('~/hooks/useMedia', () => ({ useMedia: () => false }))
vi.mock('~/utils/analytics/yields', () => ({ trackYieldsEvent: vi.fn(), YIELDS_EVENTS: {} }))

let root: Root
let container: HTMLDivElement
function Harness() {
	const ready = useLegacyYieldsUrlNormalizer({ page: 'earn', tokens: [] })
	return (
		<>
			<span data-ready={ready} />
			<YieldFilters />
		</>
	)
}

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	vi.stubGlobal('localStorage', new Storage())
	state.router.query = { apyWindow: 'avg_30d', apyComponents: 'intrinsic', pageSize: '100', page: '3' }
	state.router.push.mockClear()
	state.router.replace.mockClear()
	for (const [pref, value] of [
		[APY_WINDOW_PREF, 'avg_30d'],
		[APY_COMPONENTS_PREF, 'intrinsic'],
		[TABLE_PAGE_SIZE_PREF, '100']
	] as const) {
		localStorage.setItem(pref.storageKey, value)
	}
	localStorage.setItem('unrelated-preference', 'keep')
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	vi.unstubAllGlobals()
})

test.each([
	{ name: 'omitted defaults', filters: { chain: 'Ethereum' }, expected: [null, null, null] },
	{
		name: 'mixed saved choices',
		filters: { chain: 'Ethereum', apyWindow: 'avg_7d', pageSize: 200 },
		expected: ['avg_7d', null, '200']
	},
	{
		name: 'explicit defaults',
		filters: { apyWindow: 'current', apyComponents: 'reward', pageSize: 50 },
		expected: [null, null, null]
	}
])('loading $name prevents stale preferences from being restored', async ({ filters, expected }) => {
	state.savedFilters = { 'Saved selection': filters }
	await act(async () => root.render(<Harness />))
	const disclosure = Array.from(container.querySelectorAll('button')).find((button) =>
		button.textContent?.includes('Save view')
	)!
	await act(async () => disclosure.click())
	const load = Array.from(document.querySelectorAll('button')).find(
		(button) => button.textContent === 'Saved selection'
	)!
	expect(load).toBeDefined()
	state.router.push.mockImplementationOnce(() => {
		// Preferences must be synchronized before the destination can render.
		expect(
			[APY_WINDOW_PREF, APY_COMPONENTS_PREF, TABLE_PAGE_SIZE_PREF].map((pref) => localStorage.getItem(pref.storageKey))
		).toEqual(expected)
		return Promise.resolve(true)
	})
	await act(async () => load.click())

	expect(
		[APY_WINDOW_PREF, APY_COMPONENTS_PREF, TABLE_PAGE_SIZE_PREF].map((pref) => localStorage.getItem(pref.storageKey))
	).toEqual(expected)
	expect(localStorage.getItem('unrelated-preference')).toBe('keep')
	expect(state.router.push).toHaveBeenCalledWith({ pathname: '/yields', query: filters }, undefined, { shallow: true })
	const pushedQuery = state.router.push.mock.calls[0][0].query as Record<string, string | number>
	state.router = {
		...state.router,
		query: Object.fromEntries(Object.entries(pushedQuery).map(([key, value]) => [key, String(value)]))
	}
	await act(async () => root.render(<Harness />))
	expect(state.router.replace).not.toHaveBeenCalled()
	expect(container.querySelector('[data-ready]')?.getAttribute('data-ready')).toBe('true')
})
