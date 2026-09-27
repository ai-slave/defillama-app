// @vitest-environment happy-dom
import { afterEach, expect, test, vi } from 'vitest'
import { renderHydrated } from '../hydration'

const PAGE_CLOCK_SEC = 1_600_000_000

// Reads the live clock while rendering: the bug class renderHydrated exists to catch.
function LiveClock() {
	return <p>{Math.floor(Date.now() / 1000)}</p>
}

afterEach(() => {
	vi.useRealTimers()
})

test('a component that reads the live clock while rendering reports a mismatch', async () => {
	const rendered = await renderHydrated(<LiveClock />, { pageClockSec: PAGE_CLOCK_SEC })
	try {
		expect(rendered.serverHtml).toBe('<p>1600000000</p>')
		expect(rendered.errors.some((error) => error.includes("didn't match the client"))).toBe(true)
	} finally {
		await rendered.unmount()
	}
})

test('under a faked visitor clock the server renders at the page clock and the visitor clock comes back', async () => {
	vi.useFakeTimers({ toFake: ['Date'], now: 1_700_000_000_000 })
	const rendered = await renderHydrated(<LiveClock />, { pageClockSec: PAGE_CLOCK_SEC })
	try {
		expect(rendered.serverHtml).toBe('<p>1600000000</p>')
		expect(rendered.container.textContent).toBe('1700000000')
		expect(Date.now()).toBe(1_700_000_000_000)
	} finally {
		await rendered.unmount()
	}
})

test('a server zone leaves an unset TZ unset', async () => {
	const original = process.env.TZ
	delete process.env.TZ
	try {
		const rendered = await renderHydrated(<p>zone</p>, { pageClockSec: PAGE_CLOCK_SEC, serverTimeZone: 'Asia/Tokyo' })
		await rendered.unmount()
		expect('TZ' in process.env).toBe(false)
	} finally {
		if (original === undefined) delete process.env.TZ
		else process.env.TZ = original
	}
})
