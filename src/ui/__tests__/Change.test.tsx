// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, test } from 'vitest'
import { Change, formatChange } from '../Change'

test('formats each unit with its sign', () => {
	expect(formatChange(2.2)).toBe('+2.20%')
	expect(formatChange(-2.2)).toBe('-2.20%')
	expect(formatChange(52_100_000, 'usd')).toBe('+$52.1m')
	expect(formatChange(-1234, 'count')).toBe('-1,234')
	expect(formatChange(-0.12, 'pp')).toBe('-0.12pp')
})

test('colors up and down, leaves zero to its container and renders nothing for a missing value', async () => {
	const container = document.createElement('div')
	const root = createRoot(container)
	try {
		await act(async () =>
			root.render(
				<>
					<Change value={1} />
					<Change value={-1} />
					<Change value={0} />
					<Change value={null} />
				</>
			)
		)
		const spans = [...container.querySelectorAll('span')]
		expect(spans.map((span) => span.className)).toEqual(['text-data-up', 'text-data-down', ''])
		expect(spans[2].textContent).toBe('0%')
	} finally {
		act(() => root.unmount())
	}
})
