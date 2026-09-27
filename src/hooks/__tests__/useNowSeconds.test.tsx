// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { renderHydrated } from '~/utils/testing/hydration'
import { useNowSeconds, useNowSecondsOnce } from '../useNowSeconds'

function Clock({ initialNowSec, tickMs }: { initialNowSec?: number; tickMs: number }) {
	const now = useNowSeconds(initialNowSec, tickMs)
	return <output>{now}</output>
}

let container: HTMLDivElement
let root: Root

beforeEach(() => {
	vi.useFakeTimers({ now: 1_700_000_000_000 })
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	vi.useRealTimers()
})

test('the server renders the clock it was given', () => {
	expect(renderToStaticMarkup(<Clock initialNowSec={1_600_000_000} tickMs={1000} />)).toBe(
		'<output>1600000000</output>'
	)
})

test('a one-second subscriber sees the clock advance every second', async () => {
	await act(async () => root.render(<Clock tickMs={1000} />))
	expect(container.textContent).toBe('1700000000')

	await act(async () => {
		vi.advanceTimersByTime(1000)
	})
	expect(container.textContent).toBe('1700000001')

	await act(async () => {
		vi.advanceTimersByTime(2000)
	})
	expect(container.textContent).toBe('1700000003')
})

test('a slow subscriber alone does not tick every second', async () => {
	await act(async () => root.render(<Clock tickMs={30_000} />))
	expect(container.textContent).toBe('1700000000')

	await act(async () => {
		vi.advanceTimersByTime(5000)
	})
	expect(container.textContent).toBe('1700000000')

	await act(async () => {
		vi.advanceTimersByTime(25_000)
	})
	expect(container.textContent).toBe('1700000030')
})

function OnceClock({ label }: { label: string }) {
	return <output>{`${label}:${useNowSecondsOnce()}`}</output>
}

test('a one-off read keeps its second while a one-second clock ticks beside it', async () => {
	await act(async () =>
		root.render(
			<>
				<OnceClock label="once" />
				<Clock tickMs={1000} />
			</>
		)
	)
	expect(container.textContent).toBe('once:17000000001700000000')

	await act(async () => {
		vi.advanceTimersByTime(2000)
	})
	expect(container.textContent).toBe('once:17000000001700000002')
})

test('a one-off read keeps its second when the component re-renders later', async () => {
	await act(async () => root.render(<OnceClock label="a" />))
	expect(container.textContent).toBe('a:1700000000')

	await act(async () => {
		vi.advanceTimersByTime(5000)
	})
	await act(async () => root.render(<OnceClock label="b" />))
	expect(container.textContent).toBe('b:1700000000')
})

test('a one-off read hydrates on the page clock, then shows the second it mounted at', async () => {
	const hydrated = await renderHydrated(<OnceClock label="once" />, { pageClockSec: 1_600_000_000 })
	try {
		expect(hydrated.serverHtml).toBe('<output>once:1600000000</output>')
		expect(hydrated.errors).toEqual([])
		expect(hydrated.container.textContent).toBe('once:1700000000')
	} finally {
		await hydrated.unmount()
	}
})
