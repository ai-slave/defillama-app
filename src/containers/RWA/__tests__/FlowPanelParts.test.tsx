import { describe, expect, test } from 'vitest'
import { formatRWAChainFlowSummary, getRWAFlowDrivenCopy } from '../FlowPanelParts'

describe('RWA flow summary tooltip', () => {
	test('formats measured zero, unpriced, and unknown as distinct states', () => {
		expect(formatRWAChainFlowSummary({ status: 'measured', flow: 0, coverage: 0.5 })).toBe('$0 (50% coverage)')
		expect(formatRWAChainFlowSummary({ status: 'measured', flow: 0, coverage: 1 })).toBe('$0')
		expect(formatRWAChainFlowSummary({ status: 'notPriced' })).toBe('not priced')
		expect(formatRWAChainFlowSummary({ status: 'unknown' })).toBe('unknown, not zero')
	})

	test.each([
		{
			name: 'growth caused by inflows',
			summary: { mcapChange: 25, netCapital: 10, price: 15, flowDrivenPct: 40 },
			label: '40% inflow-driven',
			copy: "40% of this asset's growth over this period came from capital entering."
		},
		{
			name: 'growth offset by outflows',
			summary: { mcapChange: 13.04, netCapital: -6.09, price: 19.13, flowDrivenPct: -46.7 },
			label: '47% outflow offset',
			copy: "Capital outflows offset this asset's growth by an amount equal to 47% of its net market-cap increase."
		},
		{
			name: 'decline caused by outflows',
			summary: { mcapChange: -25, netCapital: -10, price: -15, flowDrivenPct: 40 },
			label: '40% outflow-driven',
			copy: "40% of this asset's decline over this period came from capital exiting."
		},
		{
			name: 'decline offset by inflows',
			summary: { mcapChange: -25, netCapital: 10, price: -35, flowDrivenPct: -40 },
			label: '40% inflow offset',
			copy: "Capital inflows offset this asset's decline by an amount equal to 40% of its net market-cap decrease."
		}
	])('describes $name', ({ summary, label, copy }) => {
		expect(getRWAFlowDrivenCopy(summary)).toEqual({
			label,
			tooltip: `${copy} The market-cap change is split into measured flows and the price-and-unattributed remainder.`
		})
	})

	test('describes zero measured flow as no contribution', () => {
		expect(getRWAFlowDrivenCopy({ mcapChange: 25, netCapital: 0, price: 25, flowDrivenPct: 0 })).toEqual({
			label: '0% flow-driven',
			tooltip:
				"Measured capital flows did not contribute to this asset's market-cap change over this period. The market-cap change is split into measured flows and the price-and-unattributed remainder."
		})
	})
})
