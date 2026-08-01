import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { IncomeStatement } from '../IncomeStatement'
import type { IProtocolOverviewPageData } from '../types'

vi.mock('next/router', () => ({
	useRouter: () => ({ pathname: '/protocol/aave', query: {} })
}))

vi.mock('~/ui/Tooltip', () => ({
	Tooltip: ({ content, children }: { content: ReactNode; children: ReactNode }) => (
		<>
			{children}
			{content}
		</>
	)
}))

describe('IncomeStatement presentation', () => {
	it('renders metrics from the explicit period values object when by-label is absent', () => {
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

		const markup = renderToStaticMarkup(
			<IncomeStatement name="Aave" incomeStatement={incomeStatement} view="table" showTitles={false} />
		)

		expect(markup).toContain('Q1 2026')
		expect(markup).toContain('$25')
		expect(markup).toContain('Cost of Revenue')
		expect(markup).toContain('$0')
	})

	it('renders a breakdown comparison when the previous value is zero', () => {
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

		const markup = renderToStaticMarkup(
			<IncomeStatement name="Aave" incomeStatement={incomeStatement} view="table" showTitles={false} />
		)

		expect(markup).toContain('compared to previous quarter total fees')
	})

	it('renders globally known by-label omissions as zero in the table and comparison', () => {
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

		const markup = renderToStaticMarkup(
			<IncomeStatement name="Aave" incomeStatement={incomeStatement} view="table" showTitles={false} />
		)

		expect(markup).toContain('$0')
		expect(markup).toContain('compared to previous quarter total swap')
	})
})
