// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, test } from 'vitest'
import type { IRawTokenRightsEntry } from '../api.types'
import { TokenRightsByProtocol } from '../TokenRightsByProtocol'
import { parseTokenRightsEntry } from '../utils'

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
	test('opens on the overview and the Details tab switches to the full breakdown', async () => {
		const container = document.createElement('div')
		document.body.append(container)
		const root = createRoot(container)
		try {
			await act(async () =>
				root.render(
					<TokenRightsByProtocol
						name="Test Protocol"
						symbol="TEST"
						raises={null}
						tokenRightsData={baseTokenRightsData}
					/>
				)
			)
			expect(container.textContent).toContain('Token rights summary')
			expect(container.textContent).not.toContain('Governance Rights')

			const details = [...container.querySelectorAll<HTMLElement>('[role="tab"]')].find(
				(tab) => tab.textContent === 'Details'
			)!
			await act(async () => details.click())
			expect(details.getAttribute('aria-selected')).toBe('true')
			expect(container.textContent).toContain('Governance Rights')
		} finally {
			await act(async () => root.unmount())
			container.remove()
		}
	})
})
