// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { SqlFreshness } from '../SqlFreshness'

const computedAt = '2026-09-12T00:00:00Z'
let root: Root
let container: HTMLDivElement

beforeEach(() => {
	vi.useFakeTimers()
	vi.setSystemTime(new Date(computedAt))
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	vi.useRealTimers()
})

async function render(value = computedAt) {
	await act(async () => root.render(<SqlFreshness computedAt={value} />))
}
async function tickAt(value: string) {
	vi.setSystemTime(new Date(value).getTime() - 30_000)
	await act(async () => vi.advanceTimersByTime(30_000))
}
function expectFreshness(text: string, title: string) {
	expect(container.textContent).toBe(`Updated ${text}`)
	expect(container.firstElementChild?.getAttribute('title')).toBe(title)
}

test('updates an idle badge at minute, 24-hour, and 48-hour boundaries', async () => {
	await render()
	expectFreshness('just now', 'Data is fresh (updated within 24h)')
	await tickAt('2026-09-12T00:01:00Z')
	expectFreshness('1min ago', 'Data is fresh (updated within 24h)')
	await tickAt('2026-09-12T23:59:30Z')
	expectFreshness('23h ago', 'Data is fresh (updated within 24h)')
	await tickAt('2026-09-13T00:00:00Z')
	expectFreshness('1d ago', 'Data is older than 24h')
	await tickAt('2026-09-13T23:59:30Z')
	expectFreshness('1d ago', 'Data is older than 24h')
	await tickAt('2026-09-14T00:00:00Z')
	expectFreshness('2d ago', 'Data is older than 48h')
	await render('2026-09-14T00:00:00Z')
	expectFreshness('just now', 'Data is fresh (updated within 24h)')
})

test('renders the same absolute timestamp on the server regardless of clock time', () => {
	for (const now of ['2026-09-12T00:00:00Z', '2026-09-14T00:00:00Z']) {
		vi.setSystemTime(new Date(now))
		container.innerHTML = renderToString(<SqlFreshness computedAt="2026-09-12T00:00:00Z" />)
		expect(container.textContent).toBe('Updated Sep 12, 2026, 12:00 AM UTC')
	}
})
