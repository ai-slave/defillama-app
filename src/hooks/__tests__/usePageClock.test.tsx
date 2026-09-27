import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, expect, test, vi } from 'vitest'
import { useNowSeconds } from '../useNowSeconds'
import { PageClockProvider } from '../usePageClock'

function Clock({ seed }: { seed?: number }) {
	return <output>{useNowSeconds(seed)}</output>
}

test('the server renders the page clock when the hook has no seed of its own', () => {
	expect(
		renderToStaticMarkup(
			<PageClockProvider pageClockSec={1_700_000_000}>
				<Clock />
			</PageClockProvider>
		)
	).toBe('<output>1700000000</output>')
})

test('a seed tied to the data wins over the page clock', () => {
	expect(
		renderToStaticMarkup(
			<PageClockProvider pageClockSec={1_700_000_000}>
				<Clock seed={1_600_000_000} />
			</PageClockProvider>
		)
	).toBe('<output>1600000000</output>')
})

test('a page without a clock cannot render the time on the server', () => {
	expect(() => renderToStaticMarkup(<Clock />)).toThrow(/no clock for the first render/)
	expect(() =>
		renderToStaticMarkup(
			<PageClockProvider pageClockSec={null}>
				<Clock />
			</PageClockProvider>
		)
	).toThrow(/no clock for the first render/)
})

afterEach(() => {
	vi.useRealTimers()
	vi.unstubAllEnvs()
	vi.restoreAllMocks()
})

test('in production a page without a clock renders the current second, not the one the server started at', () => {
	vi.stubEnv('NODE_ENV', 'production')
	vi.spyOn(console, 'error').mockImplementation(() => {})
	// Days after the module loaded, as on a long-lived server process.
	vi.useFakeTimers({ toFake: ['Date'], now: Date.now() + 5 * 86_400_000 })
	expect(renderToStaticMarkup(<Clock />)).toBe(`<output>${Math.floor(Date.now() / 1000)}</output>`)
})
