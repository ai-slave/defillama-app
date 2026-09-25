// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, test, vi } from 'vitest'
import { InlineStatStrip } from '../SummaryStats'

test('opens metric definitions on keyboard focus while preserving zero values', async () => {
	const container = document.createElement('div')
	document.body.append(container)
	const root = createRoot(container)
	const definition = 'Current value of outstanding positions.'
	try {
		await act(async () =>
			root.render(
				<InlineStatStrip
					items={[
						{ label: 'OI', value: '$0', tooltip: definition },
						{ label: 'Plain', value: '$1' }
					]}
				/>
			)
		)
		const trigger = [...container.querySelectorAll<HTMLElement>('*')].find(
			(el) => el.textContent === 'OI' && el.tabIndex >= 0
		)!
		expect(container.textContent).toContain('$0')
		expect(document.body.textContent).not.toContain(definition)
		await act(async () => trigger.focus())
		expect(document.activeElement).toBe(trigger)
		await vi.waitFor(async () => {
			await act(async () => {
				await new Promise((resolve) => setTimeout(resolve, 20))
			})
			expect(document.querySelector('[role="tooltip"]')?.textContent).toContain(definition)
		})
	} finally {
		await act(async () => root.unmount())
		container.remove()
	}
})
