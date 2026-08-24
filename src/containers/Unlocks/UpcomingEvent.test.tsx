import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { EmissionEvent } from './api.types'
import { UpcomingEvent } from './UpcomingEvent'

const cliff = (amount: number): EmissionEvent => ({
	description: 'of Team tokens will be unlocked',
	category: 'insiders',
	unlockType: 'cliff',
	timestamp: 1,
	noOfTokens: [amount]
})

const linear = (previousRate: number, newRate: number): EmissionEvent => ({
	description: 'will increase from {tokens[0]} to {tokens[1]} tokens per week from Farming on {timestamp}',
	category: 'farming',
	unlockType: 'linear',
	timestamp: 1,
	noOfTokens: [previousRate, newRate],
	rateDurationDays: 28
})

const unknown = (): EmissionEvent => ({
	description: 'of Unknown tokens will be unlocked',
	category: 'insiders',
	unlockType: 'cliff',
	timestamp: 1,
	noOfTokens: [],
	hasUnknownTokenAmount: true
})

function renderEvent(event: EmissionEvent[], isProtocolPage = true) {
	return renderToStaticMarkup(
		<UpcomingEvent
			timestamp={isProtocolPage ? 1 : Date.UTC(2100, 0, 1) / 1e3}
			event={event}
			price={2}
			symbol="TOK"
			mcap={1_000}
			maxSupply={1_000}
			name="Token"
			isProtocolPage={isProtocolPage}
		/>
	)
}

describe('UpcomingEvent amount presentation', () => {
	it('presents a linear event as the new weekly rate without projecting a duration total', () => {
		const markup = renderEvent([linear(10, 20)])

		expect(markup).toContain('Weekly Unlock Rate')
		expect(markup).toContain('$40')
		expect(markup).toContain('/ week')
		expect(markup).not.toContain('/ day')
		expect(markup).not.toContain('$160')
	})

	it('keeps cliff amounts and weekly rates in separate summaries', () => {
		const markup = renderEvent([cliff(5), linear(10, 20)])

		expect(markup).toContain('Cliff Unlock')
		expect(markup).toContain('Weekly Unlock Rate')
		expect(markup).not.toContain('Total')
	})

	it('keeps float percentages emphasized beside table summaries', () => {
		const markup = renderEvent([cliff(5), linear(10, 20)], false)

		expect(markup).toContain('mono-sm-bold text-primary">1%</span>')
		expect(markup).toContain('mono-sm-bold text-primary">4%</span>')
		expect(markup.match(/>of float<\/span>/g)).toHaveLength(2)
	})

	it('preserves known zero while leaving an unknown-only amount unavailable', () => {
		expect(renderEvent([unknown(), cliff(0)])).toContain('$0')
		expect(renderEvent([unknown()])).toContain('Amount unavailable')
	})
})
