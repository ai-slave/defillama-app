// @vitest-environment happy-dom
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import {
	ActiveFilterCard,
	ActiveFilterPills,
	FilterBrowser,
	FilterBuilderContent,
	FilterBuilderDialog
} from '~/components/FilterBuilderDialog'
import { TokensFiltersDialog } from '~/containers/Tokens/TokensFiltersDialog'
import { accessibleName } from '~/utils/testing/accessibleName'

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

function control(name: string) {
	return [...document.querySelectorAll<HTMLElement>('button, input')].find((el) => accessibleName(el) === name)!
}
async function click(el: HTMLElement) {
	await act(async () => {
		el.focus()
		el.click()
	})
}
async function type(input: HTMLInputElement, value: string) {
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
		input.dispatchEvent(new Event('input', { bubbles: true }))
	})
}
function field(label: string) {
	return [...document.querySelectorAll('label')].find((el) => el.textContent === label)!.querySelector('input')!
}
const chips = () => [...document.querySelectorAll<HTMLButtonElement>('[data-filter-chip]')]

test('adding a filter keeps focus in the list, its fields are named, and Apply writes the draft', async () => {
	const change = vi.fn()
	await act(async () => root.render(<TokensFiltersDialog filters={[]} onFiltersChange={change} />))
	await click(control('Filters'))

	const rank = control('MCap Rank')
	const next = chips()[chips().indexOf(rank as HTMLButtonElement) + 1]
	await click(rank)
	expect(chips().includes(rank as HTMLButtonElement)).toBe(false)
	expect(document.activeElement).toBe(next)

	await type(field('MCap Rank minimum'), '10')
	await click(control('Apply'))
	expect(change).toHaveBeenCalledExactlyOnceWith([{ id: 'rank', min: 10, max: null }])
})

const FILTERS = [
	{ id: 'price', label: 'Price' },
	{ id: 'volume', label: 'Volume' },
	{ id: 'holders', label: 'Holders' }
] as const
type FilterId = (typeof FILTERS)[number]['id']

// A caller session as the table pages write one: the draft lists the added filters, each with its card.
function Session({ initial }: { initial: Array<FilterId> }) {
	const [draft, setDraft] = useState(initial)
	return (
		<FilterBuilderContent
			draftCount={draft.length}
			browse={
				<FilterBrowser
					groups={[{ label: 'Market', filters: FILTERS.filter((filter) => !draft.includes(filter.id)) }]}
					onAdd={(id) => setDraft([...draft, id])}
				/>
			}
			active={draft.map((id) => (
				<ActiveFilterCard
					key={id}
					label={FILTERS.find((filter) => filter.id === id)!.label}
					category="Market"
					onRemove={() => setDraft(draft.filter((other) => other !== id))}
				>
					{null}
				</ActiveFilterCard>
			))}
			onClearAll={() => setDraft([])}
			onApply={() => {}}
		/>
	)
}

test('removing a filter hands focus to the next card, else the previous one, else the first filter to add', async () => {
	await act(async () =>
		root.render(
			<FilterBuilderDialog appliedCount={3}>
				<Session initial={['price', 'volume', 'holders']} />
			</FilterBuilderDialog>
		)
	)
	await click(control('Filters, 3 applied'))

	await click(control('Remove Volume filter'))
	expect(control('Remove Volume filter')).toBeUndefined()
	expect(document.activeElement).toBe(control('Remove Holders filter'))

	await click(control('Remove Holders filter'))
	expect(document.activeElement).toBe(control('Remove Price filter'))

	await click(control('Remove Price filter'))
	expect(document.activeElement).toBe(chips()[0])
	expect(accessibleName(chips()[0])).toBe('Price')
})

// A table page as it applies filters: the Filters button, then the applied filters as pills that clear them.
function AppliedFilters() {
	const [applied, setApplied] = useState<Array<FilterId>>(['price', 'volume', 'holders'])
	return (
		<>
			<FilterBuilderDialog appliedCount={applied.length}>{null}</FilterBuilderDialog>
			<ActiveFilterPills
				pills={applied.map((id) => ({
					id,
					label: FILTERS.find((filter) => filter.id === id)!.label,
					onRemove: () => setApplied(applied.filter((other) => other !== id))
				}))}
			/>
		</>
	)
}

test('a removed filter pill hands focus to the next pill, else the previous one, else the Filters button', async () => {
	await act(async () => root.render(<AppliedFilters />))

	await click(control('Remove Volume'))
	expect(control('Remove Volume')).toBeUndefined()
	expect(document.activeElement).toBe(control('Remove Holders'))

	await click(control('Remove Holders'))
	expect(document.activeElement).toBe(control('Remove Price'))

	await click(control('Remove Price'))
	expect(document.activeElement).toBe(control('Filters'))
})
