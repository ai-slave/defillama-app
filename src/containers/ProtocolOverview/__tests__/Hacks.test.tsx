import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { Hack } from '../../Hacks/model'
import { Hacks } from '../AdditionalInfo'

const hack = (overrides: Partial<Hack> = {}): Hack => ({
	date: 1_773_273_600,
	name: 'Aave V3',
	classification: 'Protocol Logic',
	technique: null,
	amountUsd: 862_000,
	chain: ['Ethereum'],
	bridgeHack: false,
	targetType: 'DeFi Protocol',
	returnedFundsUsd: 862_000,
	defillamaId: '1599',
	language: null,
	source: '',
	...overrides
})

const renderHacks = (hacks: Hack[]) => renderToStaticMarkup(<Hacks id="1599" name="Aave V3" hacks={hacks} />)

describe('ProtocolOverview Hacks', () => {
	it('renders measured zero while leaving unavailable values absent', () => {
		const zeroMarkup = renderHacks([hack({ date: 0, amountUsd: 0, returnedFundsUsd: 0 })])
		expect(zeroMarkup).toContain('Date:')
		expect(zeroMarkup).toContain('Amount:')
		expect(zeroMarkup).toContain('Returned Funds:')
		expect(zeroMarkup.match(/\$0/g)).toHaveLength(2)

		const unavailableMarkup = renderHacks([hack({ date: null, amountUsd: null, returnedFundsUsd: null })])
		expect(unavailableMarkup).not.toContain('Date:')
		expect(unavailableMarkup).not.toContain('Amount:')
		expect(unavailableMarkup).not.toContain('Returned Funds:')
	})
})
