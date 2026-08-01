import { describe, expect, it } from 'vitest'
import type { IIncomeStatementApiResponse } from '../api.types'
import { buildIncomeStatementMethodologies } from '../queries'

type IncomeStatementChild = NonNullable<IIncomeStatementApiResponse['childProtocols']>[number]

const child = (
	displayName: string,
	breakdownMethodology: NonNullable<IncomeStatementChild['breakdownMethodology']>
): IncomeStatementChild => ({
	displayName,
	methodology: null,
	breakdownMethodology
})

describe('buildIncomeStatementMethodologies', () => {
	it('keeps metric-level strings separate from label-level breakdown maps', () => {
		expect(
			buildIncomeStatementMethodologies({
				methodology: { Fees: 'Parent fee methodology' },
				breakdownMethodology: {
					Revenue: 'Parent revenue methodology',
					Fees: { Swap: 'Swap fee methodology' }
				},
				childProtocols: null
			})
		).toEqual({
			methodology: { Fees: 'Parent fee methodology', Revenue: 'Parent revenue methodology' },
			breakdownMethodology: { Fees: { Swap: 'Swap fee methodology' } }
		})
	})

	it('aggregates mixed child string and object values without indexing strings as maps', () => {
		expect(
			buildIncomeStatementMethodologies({
				methodology: null,
				breakdownMethodology: null,
				childProtocols: [
					child('One', { Revenue: 'Revenue methodology', Fees: { Swap: 'Swap one' } }),
					child('Two', { Revenue: 'Revenue methodology', Fees: { Swap: 'Swap two' } })
				]
			})
		).toEqual({
			methodology: { Revenue: 'Revenue methodology' },
			breakdownMethodology: { Fees: { Swap: 'One: Swap one\nTwo: Swap two' } }
		})
	})
})
