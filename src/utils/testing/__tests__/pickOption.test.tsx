// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { Select } from '~/components/Select/Select'
import { pickOption } from '../pickOption'

vi.mock('next/router', () => ({ useRouter: () => ({ query: {}, push: vi.fn(), pathname: '/' }) }))

let root: Root
let container: HTMLDivElement
beforeEach(() => {
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

test('opens a Select and picks the named option', async () => {
	const setSelectedValues = vi.fn()
	await act(async () =>
		root.render(
			<Select
				allValues={[
					{ key: 'tvl', name: 'TVL' },
					{ key: 'fees', name: 'Fees' }
				]}
				selectedValues="tvl"
				setSelectedValues={setSelectedValues}
				label="Metric"
				variant="filter"
				size="md"
			/>
		)
	)

	await pickOption(document.querySelector<HTMLElement>('button[role="combobox"]')!, 'Fees')

	expect(setSelectedValues).toHaveBeenLastCalledWith('fees')
})
