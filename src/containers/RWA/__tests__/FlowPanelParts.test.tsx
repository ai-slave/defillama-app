import { describe, expect, it } from 'vitest'
import { formatRWAChainFlowSummary } from '../FlowPanelParts'

describe('RWA flow summary tooltip', () => {
	it('formats measured zero, unpriced, and unknown as distinct states', () => {
		expect(formatRWAChainFlowSummary({ status: 'measured', flow: 0, coverage: 0.5 })).toBe('$0 (50% coverage)')
		expect(formatRWAChainFlowSummary({ status: 'measured', flow: 0, coverage: 1 })).toBe('$0')
		expect(formatRWAChainFlowSummary({ status: 'notPriced' })).toBe('not priced')
		expect(formatRWAChainFlowSummary({ status: 'unknown' })).toBe('unknown, not zero')
	})
})
