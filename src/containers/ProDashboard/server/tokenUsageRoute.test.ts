import { describe, expect, it, vi } from 'vitest'

vi.mock('~/server/db/llama', () => ({ llamaDb: { query: vi.fn() } }))

import { parseTokenUsageQuery } from './tokenUsageRoute'

describe('parseTokenUsageQuery', () => {
	it('normalizes symbols and parses the CEX policy once at the Lens boundary', () => {
		expect(
			parseTokenUsageQuery({
				'symbols[]': [' usdc ', 'USDC', 'usdt'],
				includeCex: 'true'
			})
		).toEqual({ tokenSymbols: ['USDC', 'USDT'], includeCex: true })
	})

	it('rejects missing symbols and ambiguous boolean values', () => {
		expect(parseTokenUsageQuery({ includeCex: 'false' })).toBeNull()
		expect(parseTokenUsageQuery({ 'symbols[]': 'USDC', includeCex: ['true', 'false'] })).toBeNull()
		expect(parseTokenUsageQuery({ 'symbols[]': 'USDC', includeCex: '1' })).toBeNull()
	})
})
