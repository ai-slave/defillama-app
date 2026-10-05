// @vitest-environment happy-dom
import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, test } from 'vitest'
import { VOLUME_COLUMNS, type DisplayMode } from '../../constants'
import { RankTable } from '../index'

function Harness() {
	const [mode, setMode] = useState<DisplayMode>('value')
	return (
		<>
			<RankTable
				rows={[]}
				columns={VOLUME_COLUMNS}
				mode={mode}
				setMode={setMode}
				onRefine={() => {}}
				onSelectMM={() => {}}
			/>
			<output>{mode}</output>
		</>
	)
}

let unmount = () => {}
afterEach(() => unmount())

test('picks how the metrics read as one radio choice', async () => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	const container = document.createElement('div')
	document.body.append(container)
	const root = createRoot(container)
	await act(async () => root.render(<Harness />))
	unmount = () => {
		act(() => root.unmount())
		container.remove()
	}
	const radio = (name: string) =>
		[...container.querySelectorAll<HTMLInputElement>('[role="radiogroup"][aria-label="Show as"] input')].find(
			(input) => input.closest('label')!.textContent === name
		)!

	expect(radio('Value').checked).toBe(true)
	await act(async () => radio('Percentile').click())
	expect(radio('Percentile').checked).toBe(true)
	expect(radio('Value').checked).toBe(false)
	expect(container.querySelector('output')!.textContent).toBe('percentile')
})
