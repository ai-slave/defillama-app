// @vitest-environment happy-dom
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { ChartMetricsPicker, type ChartMetricOption } from '../ChartMetricsPicker'

let container: HTMLDivElement
let root: Root
beforeEach(() => {
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

const option = (key: string, label: string): ChartMetricOption => ({
	key,
	label,
	color: '#000',
	active: true,
	defaultEnabled: true
})

function Picker() {
	const [options, setOptions] = useState([option('apy', 'APY'), option('base', 'Base APY'), option('tvl', 'TVL')])
	return (
		<div>
			<ChartMetricsPicker
				groups={[{ label: 'Metrics', options }]}
				onToggle={(toggled) =>
					setOptions((current) => current.map((o) => (o.key === toggled.key ? { ...o, active: !o.active } : o)))
				}
			/>
		</div>
	)
}

const chip = (label: string) => container.querySelector<HTMLButtonElement>(`button[aria-label="Remove ${label}"]`)

async function removeChip(label: string) {
	await act(async () => {
		chip(label)!.focus()
		chip(label)!.click()
	})
}

test('removing a metric chip hands focus to the next chip, else the previous one, else Add Metrics', async () => {
	await act(async () => root.render(<Picker />))

	await removeChip('Base APY')
	expect(chip('Base APY')).toBeNull()
	expect(document.activeElement).toBe(chip('TVL'))

	await removeChip('TVL')
	expect(document.activeElement).toBe(chip('APY'))

	await removeChip('APY')
	expect(document.activeElement?.textContent).toBe('Add Metrics')
})
