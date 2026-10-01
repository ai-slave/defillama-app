// @vitest-environment happy-dom

import { act, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { PageClockProvider } from '~/hooks/usePageClock'
import { renderHydrated } from '~/utils/testing/hydration'
import { RelativeTime } from '../RelativeTime'

const UPDATED_AT = '2026-07-24T16:30:00Z'
const UPDATED_AT_SEC = Date.parse(UPDATED_AT) / 1000

afterEach(() => {
	vi.useRealTimers()
})

describe('RelativeTime', () => {
	test('the server and the hydrating visitor agree at the page clock, then the label follows the visitor clock', async () => {
		// The page was rendered 3 hours after the update; the visitor opens it 5 hours after.
		vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'], now: (UPDATED_AT_SEC + 5 * 3600) * 1000 })
		const page = await renderHydrated(<RelativeTime value={UPDATED_AT} prefix="Updated" />, {
			pageClockSec: UPDATED_AT_SEC + 3 * 3600
		})

		expect(page.errors).toEqual([])
		expect(page.serverHtml).toContain('Updated 3h ago')
		expect(page.container.querySelector('span')!.title).toBe('Jul 24, 2026, 4:30 PM UTC')
		expect(page.container.textContent).toBe('Updated 5h ago')

		await act(async () => vi.advanceTimersByTime(60 * 60_000))
		expect(page.container.textContent).toBe('Updated 6h ago')
		await page.unmount()
	})

	test('requires an explicit unit before formatting numeric timestamps', () => {
		const render = (node: ReactNode) =>
			renderToStaticMarkup(<PageClockProvider pageClockSec={UPDATED_AT_SEC}>{node}</PageClockProvider>)
		const output = document.createElement('div')
		output.innerHTML = render(<RelativeTime value={1_753_371_000_000} />)
		expect(output.textContent).toBe('-')
		// A year before the page clock, so the label is the date.
		expect(render(<RelativeTime value={1_753_371_000_000} input="milliseconds" />)).toContain('Jul 24, 2025')
	})
})
