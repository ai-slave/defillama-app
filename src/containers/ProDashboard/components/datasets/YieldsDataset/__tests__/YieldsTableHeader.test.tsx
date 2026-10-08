// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { YieldsTableHeader } from '../YieldsTableHeader'

let root: Root
let container: HTMLDivElement
beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

const preset = (text: string) =>
	Array.from(container.querySelectorAll('[role="radiogroup"][aria-label="Column preset"] label'))
		.find((label) => label.textContent === text)!
		.querySelector<HTMLInputElement>('input[type="radio"]')!

test('a column preset is a radio choice that marks the active preset and applies the picked one', async () => {
	const applyPreset = vi.fn()
	await act(async () =>
		root.render(
			<YieldsTableHeader
				columnPresets={{ essential: ['pool'], borrow: ['pool', 'apyBorrow'] }}
				applyPreset={applyPreset}
				activePreset="essential"
				showColumnPanel={false}
				setShowColumnPanel={vi.fn()}
				downloadCSV={undefined}
				poolName=""
				setPoolName={vi.fn()}
				showFiltersPanel={false}
				setShowFiltersPanel={vi.fn()}
				activeFilterCount={0}
				filtersToggleRef={{ current: null }}
				columnsToggleRef={{ current: null }}
			/>
		)
	)
	expect(preset('Essential').checked).toBe(true)
	expect(preset('Borrow').checked).toBe(false)

	await act(async () => preset('Borrow').click())
	expect(applyPreset).toHaveBeenCalledWith('borrow')
})
