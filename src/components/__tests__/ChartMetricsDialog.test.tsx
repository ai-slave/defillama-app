// @vitest-environment happy-dom
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { accessibleName } from '~/utils/testing/accessibleName'
import { waitForUi } from '~/utils/testing/waitForUi'
import { ChartMetricsDialog, type ChartMetricOption } from '../ChartMetricsDialog'

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

function button(name: string) {
	return [...document.querySelectorAll<HTMLButtonElement>('button')].find((el) => accessibleName(el) === name)!
}
async function click(el: HTMLElement) {
	await act(async () => {
		el.focus()
		el.click()
	})
}
const dialog = () => document.querySelector('[role="dialog"]')

const NONE_LOCKED: Array<string> = []

function Chart({ locked = NONE_LOCKED, onUnlock }: { locked?: Array<string>; onUnlock?: () => void }) {
	const [picked, setPicked] = useState(['TVL'])
	const options = (labels: Array<string>): Array<ChartMetricOption> =>
		labels.map((label) => ({
			key: label,
			label,
			color: '#000',
			active: picked.includes(label),
			locked: locked.includes(label)
		}))
	return (
		<>
			<p data-testid="picked">{picked.join(',')}</p>
			<ChartMetricsDialog
				groups={[
					{ label: 'Core', options: options(['TVL', 'Fees']) },
					{ label: 'Token', options: options(['Price']) }
				]}
				onToggle={(option) =>
					setPicked((current) =>
						option.active ? current.filter((key) => key !== option.key) : current.concat(option.key)
					)
				}
				clear={{ kind: 'clear', onClear: () => setPicked([]) }}
				onUnlock={onUnlock}
			/>
		</>
	)
}

const picked = () => container.querySelector('[data-testid="picked"]')!.textContent

test('several metrics can be picked in one opening, and Done closes the dialog', async () => {
	await act(async () => root.render(<Chart />))
	await click(button('Add Metrics'))
	await click(button('Fees'))
	await click(button('Price'))

	expect(picked()).toBe('TVL,Fees,Price')
	expect(dialog()).not.toBeNull()
	expect(button('Price').getAttribute('aria-pressed')).toBe('true')
	expect(document.querySelector('[role="dialog"] p')!.textContent).toBe('3 of 3 selected')

	await click(button('Done'))
	expect(dialog()).toBeNull()
})

test('Clear all unpicks every metric and keeps focus on itself', async () => {
	await act(async () => root.render(<Chart />))
	await click(button('Add Metrics'))
	const clearAll = button('Clear all')
	await click(clearAll)

	expect(picked()).toBe('')
	expect(document.activeElement).toBe(clearAll)
	expect(clearAll.getAttribute('aria-disabled')).toBe('true')
})

test('a locked metric opens the upgrade path instead of toggling', async () => {
	const unlock = vi.fn()
	await act(async () => root.render(<Chart locked={['Price']} onUnlock={unlock} />))
	await click(button('Add Metrics'))
	expect(document.querySelector('[role="dialog"] p')!.textContent).toBe('1 of 2 selected')

	await click(button('Price, available on Pro'))
	expect(unlock).toHaveBeenCalledOnce()
	expect(picked()).toBe('TVL')
})

test("a metric's definition shows when its chip takes keyboard focus", async () => {
	await act(async () =>
		root.render(
			<ChartMetricsDialog
				groups={[
					{
						label: 'Core',
						options: [{ key: 'tvl', label: 'TVL', color: '#000', active: false, description: 'Value locked in DeFi.' }]
					}
				]}
				onToggle={() => {}}
			/>
		)
	)
	await click(button('Add Metrics'))
	const chip = button('TVL')
	expect(chip.getAttribute('aria-pressed')).toBe('false')
	await act(async () => chip.focus())
	await waitForUi(() => expect(document.querySelector('[role="tooltip"]')?.textContent).toBe('Value locked in DeFi.'))
})

test('a long catalogue opens with focus in its search field', async () => {
	const labels = Array.from({ length: 12 }, (_, index) => `Metric ${index + 1}`)
	await act(async () =>
		root.render(
			<ChartMetricsDialog
				groups={[
					{ label: 'Core', options: labels.map((label) => ({ key: label, label, color: '#000', active: false })) }
				]}
				onToggle={() => {}}
			/>
		)
	)
	await click(button('Add Metrics'))
	await waitForUi(() => expect(document.activeElement?.getAttribute('aria-label')).toBe('Search metrics'))
})
