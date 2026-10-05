// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { IEquitiesStatementsResponse } from '~/containers/Equities/api.types'
import { getEquitiesTableQueryKey } from '~/containers/ProDashboard/equitiesTableQueryKeys'
import { EquitiesFinancialsDataset } from '../EquitiesFinancialsDataset'

vi.mock('next/router', () => ({ useRouter: () => ({ pathname: '/pro/test', query: {}, push: vi.fn() }) }))

const section = (label: string) => ({
	labels: [label],
	children: { quarterly: {}, annual: {} },
	quarterly: { periodEnding: ['2026-03-31'], values: [[1]], children: {} },
	annual: { periodEnding: ['2025-12-31'], values: [[4]], children: {} }
})
const STATEMENTS: IEquitiesStatementsResponse = {
	incomeStatement: section('Revenue'),
	balanceSheet: section('Total Assets'),
	cashflow: section('Operating Cash Flow')
}

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

const option = (group: string, text: string) =>
	Array.from(container.querySelectorAll(`[role="radiogroup"][aria-label="${group}"] label`))
		.find((label) => label.textContent === text)!
		.querySelector<HTMLInputElement>('input[type="radio"]')!
const rowLabels = () => Array.from(container.querySelectorAll('tbody tr'), (row) => row.firstElementChild?.textContent)

test('the statement and period radios pick which statement rows the table shows', async () => {
	const client = new QueryClient()
	client.setQueryData(getEquitiesTableQueryKey('statements', 'AAPL')!, STATEMENTS)
	await act(async () =>
		root.render(
			<QueryClientProvider client={client}>
				<EquitiesFinancialsDataset ticker="AAPL" />
			</QueryClientProvider>
		)
	)
	expect(option('Statement', 'Income Statement').checked).toBe(true)
	expect(rowLabels()).toEqual(['Revenue'])

	await act(async () => option('Statement', 'Balance Sheet').click())
	expect(option('Statement', 'Balance Sheet').checked).toBe(true)
	expect(rowLabels()).toEqual(['Total Assets'])

	expect(container.querySelector('thead')?.textContent).toContain('2026')
	await act(async () => option('Period', 'Annual').click())
	expect(option('Period', 'Annual').checked).toBe(true)
	expect(container.querySelector('thead')?.textContent).toContain('2025')
	client.clear()
})
