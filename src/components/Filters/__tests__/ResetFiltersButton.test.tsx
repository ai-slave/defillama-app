// @vitest-environment happy-dom
import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, onTestFinished, test } from 'vitest'
import { ResetFiltersButton } from '../ResetFiltersButton'

function FilterBar({ nestedMenu }: { nestedMenu: boolean }) {
	const [filtered, setFiltered] = useState(true)
	return (
		<ResetFiltersButton nestedMenu={nestedMenu} onClick={() => setFiltered(false)} disabled={!filtered}>
			Reset filters
		</ResetFiltersButton>
	)
}

test.each([false, true])(
	'reset keeps focus once clearing the filters disables it (phone menu: %s)',
	async (nestedMenu) => {
		const container = document.createElement('div')
		document.body.append(container)
		const root = createRoot(container)
		onTestFinished(async () => {
			await act(async () => root.unmount())
			container.remove()
		})
		await act(async () => root.render(<FilterBar nestedMenu={nestedMenu} />))
		const reset = container.querySelector('button')!
		await act(async () => reset.focus())
		await act(async () => reset.click())

		expect(reset.getAttribute('aria-disabled')).toBe('true')
		// Browsers drop focus from a natively disabled button; happy-dom does not, so assert the cause.
		expect(reset.disabled).toBe(false)
		expect(document.activeElement).toBe(reset)
	}
)
