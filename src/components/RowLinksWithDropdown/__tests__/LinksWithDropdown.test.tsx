// @vitest-environment happy-dom
import { act } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { type HydrationResult, renderHydrated } from '~/utils/testing/hydration'
import { waitForUi } from '~/utils/testing/waitForUi'
import { LinksWithDropdown } from '../LinksWithDropdown'

vi.mock('next/router', () => ({ useRouter: () => ({ push: vi.fn(() => Promise.resolve(true)), asPath: '/' }) }))

const PILL_WIDTH = 50
const chains = Array.from({ length: 400 }, (_, i) => ({ label: `Chain ${i}`, to: `/chain/chain-${i}` }))

// happy-dom has no layout: pills sit in rows of `pillsPerRow`, and the row is exactly that wide.
let pillsPerRow = 5
// The most pills present in the row while it was being measured.
let mostPillsMeasured = 0
let rendered: HydrationResult

beforeEach(() => {
	pillsPerRow = 5
	mostPillsMeasured = 0
	vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
		if (this.hasAttribute('data-priority-nav-item')) {
			const pills = this.parentElement!.querySelectorAll('[data-priority-nav-item]')
			mostPillsMeasured = Math.max(mostPillsMeasured, pills.length)
			const top = Array.prototype.indexOf.call(pills, this) < pillsPerRow ? 0 : 40
			return DOMRect.fromRect({ x: 0, y: top, width: PILL_WIDTH, height: 24 })
		}
		if (this.querySelector(':scope > [data-priority-nav-item]'))
			return DOMRect.fromRect({ x: 0, y: 0, width: pillsPerRow * PILL_WIDTH, height: 32 })
		return DOMRect.fromRect({ x: 0, y: 0, width: 0, height: 0 })
	})
})

afterEach(async () => {
	await rendered.unmount()
	vi.restoreAllMocks()
})

const pillCount = () => rendered.container.querySelectorAll('[data-priority-nav-item]').length

async function hydrateRow() {
	rendered = await renderHydrated(<LinksWithDropdown heading="Chains" links={chains} />, {
		pageClockSec: 1_700_000_000
	})
	expect(rendered.errors).toEqual([])
}

test('a row that wraps measures only the links the server rendered, and keeps the ones that fit', async () => {
	await hydrateRow()

	expect(pillCount()).toBe(5)
	expect(mostPillsMeasured).toBe(20)
})

test('a row wide enough for every server-rendered link measures the full list', async () => {
	pillsPerRow = 30

	await hydrateRow()

	expect(pillCount()).toBe(30)
})

test('widening a row past the links it measured measures the rest', async () => {
	await hydrateRow()
	pillsPerRow = 30

	await act(async () => {
		window.dispatchEvent(new Event('resize'))
		// Past the row's resize debounce.
		await new Promise((resolve) => setTimeout(resolve, 150))
	})

	await waitForUi(() => expect(pillCount()).toBe(30))
})

test('a new link set starts from the first links again after a wide row measured every link of the last one', async () => {
	pillsPerRow = 30
	await hydrateRow()
	expect(mostPillsMeasured).toBe(400)
	pillsPerRow = 5
	mostPillsMeasured = 0

	const protocols = Array.from({ length: 400 }, (_, i) => ({ label: `Protocol ${i}`, to: `/protocol/protocol-${i}` }))
	await rendered.update(<LinksWithDropdown heading="Protocols" links={protocols} />)

	expect(pillCount()).toBe(5)
	expect(mostPillsMeasured).toBe(20)
})
