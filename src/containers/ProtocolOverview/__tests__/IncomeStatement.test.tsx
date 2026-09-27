// @vitest-environment happy-dom
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { waitForUi } from '~/utils/testing/waitForUi'
import { IncomeStatement } from '../IncomeStatement'
import type { IProtocolOverviewPageData } from '../types'

vi.mock('next/router', () => ({
	useRouter: () => ({ pathname: '/protocol/aave', query: {} })
}))

let container: HTMLDivElement
let root: Root
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
async function renderStatement(node: ReactNode) {
	await act(async () => root.render(node))
	return container.textContent
}
const rowCells = (label: string) => {
	const row = Array.from(container.querySelectorAll('tr')).find(
		(row) => row.querySelector('th')?.textContent === label
	)!
	return Array.from(row.querySelectorAll('td'), (cell) => cell.textContent)
}
async function openComparison(label: string, value: string) {
	const row = Array.from(container.querySelectorAll('tr')).find(
		(row) => row.querySelector('th')?.textContent === label
	)!
	const cell = Array.from(row.querySelectorAll('td')).find((cell) => cell.textContent === value)!
	await act(async () => cell.querySelector('span')!.dispatchEvent(new Event('touchstart', { bubbles: true })))
	await waitForUi(() => expect(document.querySelector('[role="tooltip"]')).not.toBeNull())
	return document.querySelector('[role="tooltip"]')!.textContent
}

describe('IncomeStatement presentation', () => {
	test('renders metrics from the explicit period values object when by-label is absent', async () => {
		const incomeStatement = {
			data: {
				monthly: {},
				quarterly: {
					'2026-Q1': {
						timestamp: Date.parse('2026-01-01'),
						values: { 'Gross Protocol Revenue': { value: 25 } }
					}
				},
				yearly: {},
				cumulative: {}
			},
			labelsByType: {},
			methodology: {},
			breakdownMethodology: {},
			hasOtherTokenHolderFlows: false,
			hasTokenHolderNetIncome: false
		} satisfies NonNullable<IProtocolOverviewPageData['incomeStatement']>

		const markup = await renderStatement(
			<IncomeStatement name="Aave" incomeStatement={incomeStatement} view="table" showTitles={false} />
		)

		expect(markup).toContain('Q1 2026')
		expect(rowCells('Gross Protocol Revenue')).toEqual(['$25'])
	})

	test('renders a breakdown comparison when the previous value is zero', async () => {
		const incomeStatement = {
			data: {
				monthly: {},
				quarterly: {
					'2026-Q2': {
						timestamp: Date.parse('2026-04-01'),
						values: { 'Gross Protocol Revenue': { value: 25, 'by-label': { Fees: 20 } } }
					},
					'2026-Q1': {
						timestamp: Date.parse('2026-01-01'),
						values: { 'Gross Protocol Revenue': { value: 15, 'by-label': { Fees: 10 } } }
					},
					'2025-Q4': {
						timestamp: Date.parse('2025-10-01'),
						values: { 'Gross Protocol Revenue': { value: 5, 'by-label': { Fees: 0 } } }
					}
				},
				yearly: {},
				cumulative: {}
			},
			labelsByType: { 'Gross Protocol Revenue': ['Fees'] },
			methodology: {},
			breakdownMethodology: {},
			hasOtherTokenHolderFlows: false,
			hasTokenHolderNetIncome: false
		} satisfies NonNullable<IProtocolOverviewPageData['incomeStatement']>

		const markup = await renderStatement(
			<IncomeStatement name="Aave" incomeStatement={incomeStatement} view="table" showTitles={false} />
		)

		expect(markup).toContain('$10')
		expect(await openComparison('Fees', '$10')).toBe('0% compared to previous quarter total fees')
	})

	test('renders globally known by-label omissions as zero in the table and comparison', async () => {
		const incomeStatement = {
			data: {
				monthly: {},
				quarterly: {
					'2026-Q3': {
						timestamp: Date.parse('2026-07-01'),
						values: { 'Gross Protocol Revenue': { value: 20, 'by-label': { Swap: 20 } } }
					},
					'2026-Q2': {
						timestamp: Date.parse('2026-04-01'),
						values: { 'Gross Protocol Revenue': { value: 0 } }
					},
					'2026-Q1': {
						timestamp: Date.parse('2026-01-01'),
						values: { 'Gross Protocol Revenue': { value: 10, 'by-label': { Swap: 10 } } }
					}
				},
				yearly: {},
				cumulative: {}
			},
			labelsByType: { 'Gross Protocol Revenue': ['Swap'] },
			methodology: {},
			breakdownMethodology: {},
			hasOtherTokenHolderFlows: false,
			hasTokenHolderNetIncome: false
		} satisfies NonNullable<IProtocolOverviewPageData['incomeStatement']>

		const markup = await renderStatement(
			<IncomeStatement name="Aave" incomeStatement={incomeStatement} view="table" showTitles={false} />
		)

		expect(markup).toContain('$0')
		expect(await openComparison('Swap', '$0')).toContain('compared to previous quarter total swap')
	})

	test('renders off-chain costs as Unknown rows only for protocols with a disclosure', async () => {
		const incomeStatement = {
			data: {
				monthly: {},
				quarterly: {
					'2026-Q1': {
						timestamp: Date.parse('2026-01-01'),
						values: { 'Gross Protocol Revenue': { value: 25 } }
					}
				},
				yearly: {},
				cumulative: {}
			},
			labelsByType: {},
			methodology: {},
			breakdownMethodology: {},
			hasOtherTokenHolderFlows: false,
			hasTokenHolderNetIncome: false
		} satisfies NonNullable<IProtocolOverviewPageData['incomeStatement']>

		const render = (name: string) =>
			renderStatement(<IncomeStatement name={name} incomeStatement={incomeStatement} view="table" showTitles={false} />)
		const unknownRows = () =>
			Array.from(container.querySelectorAll('tr'))
				.filter((row) => row.querySelector('td')?.textContent === 'Unknown')
				.map((row) => row.querySelector('th')!.textContent)

		await render('EtherFi Cash Liquid')
		expect(unknownRows()).toEqual(['FX & cross-border costs', 'Card issuer & network costs'])

		await render('Aave')
		expect(unknownRows()).toEqual([])
	})
})
