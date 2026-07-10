import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { IRawTokenRightsEntry } from '../api.types'
import { TokenRightsByProtocol } from '../TokenRightsByProtocol'
import { parseTokenRightsEntry } from '../utils'

vi.mock('~/components/Copy', () => ({
	CopyHelper: () => null
}))

vi.mock('~/components/Icon', () => ({
	Icon: () => null
}))

vi.mock('~/components/TokenLogo', () => ({
	TokenLogo: () => null
}))

vi.mock('~/ui/Tooltip', () => ({
	Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>
}))

vi.mock('~/containers/Raises/utils', () => ({
	formatRaiseAmount: () => null
}))

vi.mock('~/utils', () => ({
	formattedNum: (value: number) => String(value)
}))

const baseTokenRightsEntry: IRawTokenRightsEntry = {
	'Protocol Name': 'Test Protocol',
	Token: ['TEST'],
	'Token Type': ['Governance'],
	'Brief description': 'Protocol description',
	'Governance Details (Summary)': 'Governance summary',
	'Governance Decisions': ['TEST'],
	'Treasury Decisions': ['TEST'],
	'Revenue Decisions': ['TEST'],
	'Fee Switch Status': 'OFF',
	Buybacks: ['TEST'],
	Dividends: ['N/A'],
	Burns: 'N/A',
	'Value Accrual': 'Buybacks',
	'Value Accrual Details': 'Value accrues via buybacks.',
	'Associated Entities': [],
	'Last Updated': '2026-04-15',
	'DefiLlama ID': 'test-protocol'
}

const baseTokenRightsData = parseTokenRightsEntry(baseTokenRightsEntry)

describe('TokenRightsByProtocol', () => {
	it('renders the overview view by default with a details toggle', () => {
		const html = renderToStaticMarkup(
			<TokenRightsByProtocol name="Test Protocol" symbol="TEST" raises={null} tokenRightsData={baseTokenRightsData} />
		)

		expect(html).toContain('Overview')
		expect(html).toContain('Details')
		expect(html).toContain('Token rights summary')
		expect(html).toContain('Primary Value Accrual')
		expect(html).not.toContain('Governance Rights')
	})

	it('filters inactive token labels from overview identity pills', () => {
		const html = renderToStaticMarkup(
			<TokenRightsByProtocol
				name="Test Protocol"
				symbol="TEST"
				raises={null}
				headerVariant="embedded"
				tokenRightsData={parseTokenRightsEntry({ ...baseTokenRightsEntry, Token: ['N/A', 'TEST'] })}
			/>
		)

		expect(html).toContain('TEST')
		expect(html).not.toContain('N/A')
	})

	it('shows primary value accrual details without rendering N/A as the primary value', () => {
		const html = renderToStaticMarkup(
			<TokenRightsByProtocol
				name="Test Protocol"
				symbol="TEST"
				raises={null}
				initialView="details"
				tokenRightsData={parseTokenRightsEntry({
					...baseTokenRightsEntry,
					'Value Accrual': 'N/A',
					'Value Accrual Details': 'No primary accrual mechanism.'
				})}
			/>
		)

		expect(html).toContain('Primary Value Accrual')
		expect(html).toContain('No primary accrual mechanism.')
		expect(html).not.toContain('tracking-wider uppercase">N/A</span>')
	})

	it('hides the primary value accrual card when primary value and details are absent', () => {
		const html = renderToStaticMarkup(
			<TokenRightsByProtocol
				name="Test Protocol"
				symbol="TEST"
				raises={null}
				tokenRightsData={parseTokenRightsEntry({
					...baseTokenRightsEntry,
					'Value Accrual': 'N/A',
					'Value Accrual Details': undefined
				})}
			/>
		)

		expect(html).not.toContain('Primary Value Accrual')
	})

	it('still shows the primary value accrual card when details exist and the primary value is null', () => {
		const html = renderToStaticMarkup(
			<TokenRightsByProtocol
				name="Test Protocol"
				symbol="TEST"
				raises={null}
				initialView="details"
				tokenRightsData={parseTokenRightsEntry({
					...baseTokenRightsEntry,
					'Value Accrual': undefined
				})}
			/>
		)

		expect(html).toContain('Primary Value Accrual')
		expect(html).toContain('Value accrues via buybacks.')
	})

	it('renders the embedded token page header variant', () => {
		const html = renderToStaticMarkup(
			<TokenRightsByProtocol
				name="Test Protocol"
				symbol="TEST"
				raises={null}
				tokenRightsData={baseTokenRightsData}
				headerVariant="embedded"
			/>
		)

		expect(html).toContain('Token Rights and Value Accrual')
	})

	it('marks value accrual active when either dividends or buybacks accrue value', () => {
		const html = renderToStaticMarkup(
			<TokenRightsByProtocol name="Test Protocol" symbol="TEST" raises={null} tokenRightsData={baseTokenRightsData} />
		)

		expect(html).toContain('Value Accrual: positive')
	})

	it('keeps dividend and buyback pie segments inactive when neither mechanism accrues value', () => {
		const html = renderToStaticMarkup(
			<TokenRightsByProtocol
				name="Test Protocol"
				symbol="TEST"
				raises={null}
				tokenRightsData={parseTokenRightsEntry({
					...baseTokenRightsEntry,
					Buybacks: ['None'],
					Dividends: ['None']
				})}
			/>
		)

		expect(html).toContain('Value Accrual: negative')
	})
})
