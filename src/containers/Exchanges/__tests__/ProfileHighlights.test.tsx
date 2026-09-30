// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { ExchangePairModel, ExchangeProfileModel } from '../models'
import { ProfileHighlights } from '../ProfileHighlights'

const BASES = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'DOT']
const profile = {
	segments: {
		spot: {
			pairs: BASES.map(
				(base, index) =>
					({
						pairUrl: `https://venue.example/${base}`,
						symbol: `${base}/USDT`,
						base,
						quote: 'USDT',
						baseGeckoId: null,
						price: 1,
						priceChange24h: 0.1 - index / 100,
						volume24h: 5e6
					}) as ExchangePairModel
			)
		}
	}
} as unknown as ExchangeProfileModel

const PILL_HEIGHT = 50
/** The leftover height the chart column leaves the grid at xl. */
let gridHeight = 0
let isXl = false
let notifyMedia = () => {}
const observers = new Set<{ notify: () => void }>()
let container: HTMLDivElement
let root: Root

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(() => PILL_HEIGHT)
	vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function (this: HTMLElement) {
		return this.previousElementSibling?.id === 'exchange-top-movers' ? gridHeight : 0
	})
	vi.stubGlobal('matchMedia', () => ({
		get matches() {
			return isXl
		},
		addEventListener: (_type: string, listener: () => void) => (notifyMedia = listener),
		removeEventListener: () => {}
	}))
	vi.stubGlobal(
		'ResizeObserver',
		class {
			constructor(private callback: () => void) {}
			notify = () => this.callback()
			observe() {
				observers.add(this)
				// A real observer reports the size once when observation starts.
				queueMicrotask(this.notify)
			}
			disconnect() {
				observers.delete(this)
			}
		}
	)
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	observers.clear()
	vi.unstubAllGlobals()
	vi.restoreAllMocks()
})

const shownMovers = () => container.querySelectorAll('a').length

test('shows one row of movers below xl and as many whole rows as the leftover height fits at xl', async () => {
	gridHeight = 150
	await act(async () => root.render(<ProfileHighlights profile={profile} />))
	expect(shownMovers()).toBe(3)

	isXl = true
	await act(async () => notifyMedia())
	// Two 50px rows and their 8px gap fit in 150px; a third does not.
	expect(shownMovers()).toBe(6)

	gridHeight = 400
	await act(async () => {
		for (const observer of observers) observer.notify()
	})
	// Never more than three rows, however much height is left.
	expect(shownMovers()).toBe(9)
})
