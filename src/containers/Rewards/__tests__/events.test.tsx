// @vitest-environment happy-dom
import type { ParsedUrlQuery } from 'node:querystring'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import Rewards from '..'
import { program } from './fixtures'

const router = vi.hoisted(() => ({
	query: {} as ParsedUrlQuery,
	pathname: '/rewards',
	asPath: '/rewards',
	push: vi.fn()
}))
vi.mock('next/router', () => ({ useRouter: () => router }))
const track = vi.fn()
function preventTestNavigation(event: Event) {
	if (event.target instanceof Element && event.target.closest('a')) event.preventDefault()
}
const context = { experiment: 'rewards-featured-cards-v1', variant: 'a' }
const programs = [
	program({ programId: 'example', protocol: 'Example', protocolHref: '/protocol/example' }),
	program({
		programId: 'other',
		protocol: 'Other',
		lifecycle: 'Ended',
		rewardTypes: ['Commission'],
		verification: 'Unverified'
	})
]

describe('Rewards interaction events', () => {
	let container: HTMLDivElement
	let root: Root
	beforeEach(() => {
		router.query = {}
		router.push.mockReset().mockResolvedValue(true)
		window.sessionStorage.clear()
		document.cookie = 'defillama-ab-group=a; path=/'
		vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
		window.umami = { track, identify: vi.fn() }
		track.mockClear()
		document.addEventListener('click', preventTestNavigation)
		document.addEventListener('auxclick', preventTestNavigation)
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
	})
	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
		document.removeEventListener('click', preventTestNavigation)
		document.removeEventListener('auxclick', preventTestNavigation)
		delete window.umami
		vi.restoreAllMocks()
		vi.useRealTimers()
	})
	async function render() {
		await act(async () =>
			root.render(<Rewards programs={programs} popularityOrder={['other', 'example']} featuredCardIds={['example']} />)
		)
	}
	const events = (name: string) => track.mock.calls.filter(([event]) => event === name)
	async function click(selector: string, text: string) {
		const button = [...container.querySelectorAll<HTMLElement>(selector)].find((el) =>
			el.textContent?.trim().startsWith(text)
		)!
		await act(async () => button.click())
	}
	async function search(value: string) {
		const input = container.querySelector<HTMLInputElement>('input[aria-label="Search protocols or programs"]')!
		await act(async () => {
			Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
			input.dispatchEvent(new Event('input', { bubbles: true }))
		})
	}

	test.each(['a', 'b'])('attributes experiment exposure to cookie group %s', async (variant) => {
		document.cookie = `defillama-ab-group=${variant}; path=/`
		await render()
		expect(events('rewards-experiment-exposure')).toEqual([['rewards-experiment-exposure', { ...context, variant }]])
	})

	test('uses variant a without a group cookie', async () => {
		document.cookie = 'defillama-ab-group=; Max-Age=0; path=/'
		await render()
		expect(events('rewards-experiment-exposure')).toEqual([['rewards-experiment-exposure', context]])
	})

	test('tracks each status change and skips clicks on the active pill', async () => {
		await render()
		await click('[role="radiogroup"][aria-label="Status"] label', 'All')
		await click('[role="radiogroup"][aria-label="Status"] label', 'Live')
		router.query = { status: 'Live' }
		await render()
		const checkedStatus = container.querySelector('[role="radiogroup"][aria-label="Status"] input:checked')!
		expect(checkedStatus.closest('label')!.textContent).toBe('Live 1')
		await click('[role="radiogroup"][aria-label="Status"] label', 'Live')
		await click('[role="radiogroup"][aria-label="Status"] label', 'All')
		expect(events('rewards-filter-status')).toEqual([
			['rewards-filter-status', { ...context, value: 'Live' }],
			['rewards-filter-status', { ...context, value: 'All' }]
		])
		expect(router.push).toHaveBeenCalledTimes(2)
	})

	test('skips the reward All pill when no type is selected', async () => {
		await render()
		await click('[aria-label="Reward type"] button', 'All')
		expect(events('rewards-filter-reward-type')).toEqual([])
		expect(router.push).not.toHaveBeenCalled()
	})

	test('preserves queued interactions across filtering and flushes them once in order', async () => {
		delete window.umami
		await render()
		await click('[role="radiogroup"][aria-label="Status"] label', 'Live')
		router.query = { status: 'Live' }
		await render()
		expect(container.querySelectorAll('tbody a[data-reward-program-id]')).toHaveLength(1)
		await click('a', 'Add Your Rewards')
		window.umami = { track, identify: vi.fn() }
		expect(track).not.toHaveBeenCalled()
		window.dispatchEvent(new Event('umami-ready'))
		expect(track.mock.calls.filter(([name]) => name !== 'rewards-experiment-exposure')).toEqual([
			['rewards-filter-status', { ...context, value: 'Live' }],
			['rewards-submit-click', context]
		])
		window.dispatchEvent(new Event('umami-ready'))
		expect(events('rewards-filter-status')).toHaveLength(1)
		expect(events('rewards-submit-click')).toHaveLength(1)
	})

	test('discards queued interactions when Rewards unmounts before Umami is ready', async () => {
		delete window.umami
		await render()
		await click('[role="radiogroup"][aria-label="Status"] label', 'Live')
		await act(async () => root.unmount())
		window.umami = { track, identify: vi.fn() }
		window.dispatchEvent(new Event('umami-ready'))
		expect(track).not.toHaveBeenCalled()
	})

	test('tracks reward type selection, deselection and clearing', async () => {
		await render()
		await click('[aria-label="Reward type"] button', 'Points')
		router.query = { reward: ['Points'] }
		await render()
		await click('[aria-label="Reward type"] button', 'Commission')
		router.query = { reward: ['Points', 'Commission'] }
		await render()
		await click('[aria-label="Reward type"] button', 'Commission')
		await click('[aria-label="Reward type"] button', 'All')
		expect(events('rewards-filter-reward-type')).toEqual(
			[
				['Points', true],
				['Commission', true],
				['Commission', false],
				['All', true]
			].map(([value, selected]) => ['rewards-filter-reward-type', { ...context, value, selected }])
		)
	})

	test('tracks hide-unverified changes as booleans', async () => {
		await render()
		await act(async () => container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click())
		router.query = { hideUnverified: 'true' }
		await render()
		await act(async () => container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click())
		expect(events('rewards-filter-hide-unverified')).toEqual([
			['rewards-filter-hide-unverified', { ...context, value: true }],
			['rewards-filter-hide-unverified', { ...context, value: false }]
		])
	})

	test('Reset sends only its own event even after sorting, filtering and expanding', async () => {
		router.query = { status: 'Live', reward: ['Points'], hideUnverified: 'true' }
		await render()
		await click('thead button', 'Protocol / Program')
		await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Details for Example"]')!.click())
		track.mockClear()
		await click('button', 'Reset')
		expect(track.mock.calls).toEqual([['rewards-filter-reset', context]])
	})

	test('debounces search, reports the settled term and count, and ignores clearing', async () => {
		vi.useFakeTimers()
		await render()
		await search('E')
		await act(async () => vi.advanceTimersByTime(100))
		await search('Ex')
		await act(async () => vi.advanceTimersByTime(100))
		await search(' EXA ')
		await act(async () => vi.advanceTimersByTime(599))
		expect(events('rewards-search')).toEqual([])
		await act(async () => vi.advanceTimersByTime(1))
		expect(events('rewards-search')).toEqual([['rewards-search', { ...context, term: 'exa', results: 1 }]])
		await search('')
		await act(async () => vi.advanceTimersByTime(1000))
		expect(events('rewards-search')).toHaveLength(1)
		await search('Exa')
		await act(async () => vi.advanceTimersByTime(600))
		expect(events('rewards-search')).toHaveLength(2)
	})

	test('Reset drops a search that has not settled yet', async () => {
		vi.useFakeTimers()
		await render()
		await search('Exa')
		await act(async () => vi.advanceTimersByTime(300))
		await click('button', 'Reset')
		await act(async () => vi.advanceTimersByTime(1000))
		expect(events('rewards-search')).toEqual([])
	})

	test('tracks sorting in both directions and clearing, but not initial render', async () => {
		await render()
		expect(events('rewards-table-sort')).toEqual([])
		await click('thead button', 'Protocol / Program')
		await click('thead button', 'Protocol / Program')
		await click('thead button', 'Protocol / Program')
		expect(events('rewards-table-sort')).toEqual(
			['asc', 'desc', 'none'].map((direction) => ['rewards-table-sort', { ...context, column: 'protocol', direction }])
		)
	})

	test('tracks expansion, skips collapse, and tracks reopening', async () => {
		await render()
		const button = container.querySelector<HTMLButtonElement>('[aria-label="Details for Example"]')!
		await act(async () => button.click())
		await act(async () => button.click())
		expect(events('rewards-row-expand')).toEqual([
			['rewards-row-expand', { ...context, program_id: 'example', project_path: '/protocol/example' }]
		])
		await act(async () => button.click())
		expect(events('rewards-row-expand')).toHaveLength(2)
	})

	test('tracks protocol name clicks and middle clicks without counting outbound conversions', async () => {
		await render()
		const link = container.querySelector<HTMLAnchorElement>('tbody a[href="/protocol/example"]')!
		await act(async () => link.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 })))
		await act(async () => link.dispatchEvent(new MouseEvent('auxclick', { bubbles: true, button: 1 })))
		await act(async () => link.dispatchEvent(new MouseEvent('auxclick', { bubbles: true, button: 2 })))
		expect(events('rewards-protocol-click')).toEqual(
			Array.from({ length: 2 }, () => [
				'rewards-protocol-click',
				{ ...context, program_id: 'example', project_path: '/protocol/example' }
			])
		)
		expect(events('rewards-experiment-conversion')).toEqual([])
	})

	test('tracks Add Your Rewards activations, including repeats', async () => {
		await render()
		await click('a', 'Add Your Rewards')
		await click('a', 'Add Your Rewards')
		expect(events('rewards-submit-click')).toEqual([
			['rewards-submit-click', context],
			['rewards-submit-click', context]
		])
	})
})
