// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, test, vi } from 'vitest'
import { TopMovers } from '../TopMovers'

vi.mock('~/components/TokenLogo', () => ({ TokenLogo: () => null }))

test('keeps unmatched and repeated movers distinct across a reordered refresh', async () => {
	const container = document.createElement('div')
	const root = createRoot(container)
	const error = vi.spyOn(console, 'error')
	const a = { asset: '', name: 'A', momChangePct: 1 }
	const b = { asset: '', name: 'B', momChangePct: 2 }
	const rows = () => container.firstElementChild!.children
	try {
		await act(async () => root.render(<TopMovers movers={[a, b, a]} />))
		const firstA = rows()[1],
			firstB = rows()[2],
			secondA = rows()[3]
		expect(firstA).not.toBe(secondA)
		await act(async () => root.render(<TopMovers movers={[{ ...b, momChangePct: 3 }, a, a]} />))
		expect(rows()[1]).toBe(firstB)
		expect(rows()[2]).toBe(firstA)
		expect(rows()[3]).toBe(secondA)
		expect(error.mock.calls.some((args) => args.some((arg) => String(arg).includes('same key')))).toBe(false)
	} finally {
		await act(async () => root.unmount())
		error.mockRestore()
	}
})
