import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
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

function renderEvent(event: Array<EmissionEvent>, isProtocolPage = true) {
	return renderToStaticMarkup(
		<UpcomingEvent
			timestamp={isProtocolPage ? 1 : Date.UTC(2100, 0, 1) / 1e3}
			event={event}
			price={2}
			symbol="TOK"
			mcap={1000}
			maxSupply={1000}
			name="Token"
			isProtocolPage={isProtocolPage}
		/>
	)
}

describe('UpcomingEvent amount presentation', () => {
	test('presents a linear event as the new weekly rate without projecting a duration total', () => {
		const markup = renderEvent([linear(10, 20)])

		expect(markup).toContain('Weekly Unlock Rate')
		expect(markup).toContain('$40')
		expect(markup).toContain('/ week')
		expect(markup).not.toContain('/ day')
		expect(markup).not.toContain('$160')
	})

	test('keeps cliff amounts and weekly rates in separate summaries', () => {
		const text = renderEvent([cliff(5), linear(10, 20)])
			.replace(/<[^>]+>/g, ' ')
			.replace(/\s+/g, ' ')

		expect(text).toContain('Cliff Unlock $10 0.5%')
		expect(text).toContain('Weekly Unlock Rate $40 / week 2%')
	})

	test('shows each table summary as a share of float', () => {
		const text = renderEvent([cliff(5), linear(10, 20)], false)
			.replace(/<[^>]+>/g, ' ')
			.replace(/\s+/g, ' ')

		expect(text.match(/\d+% of float/g)).toEqual(['1% of float', '4% of float'])
	})

	test('preserves known zero while leaving an unknown-only amount unavailable', () => {
		expect(renderEvent([unknown(), cliff(0)])).toContain('$0')
		expect(renderEvent([unknown()])).toContain('Amount unavailable')
	})

	test('labels signed burn events without presenting negative unlock values', () => {
		const markup = renderEvent([cliff(-5), linear(10, -20)])

		expect(markup).toContain('Cliff Burn')
		expect(markup).toContain('Weekly Burn Rate')
		expect(markup).not.toContain('-$')
	})
})
