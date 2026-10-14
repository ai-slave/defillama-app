import { describe, expect, test } from 'vitest'
import { buildProtocolMetaDescription, protocolDescriptionSentence, protocolMetaMetricClause } from '../protocolSeo'

const AAVE = 'Aave is an Open Source and Non-Custodial protocol to earn interest on deposits and borrow assets'
const VEST =
	'Vest Exchange is a next generation Perps DEX that ensures the most capital efficient liquidity, and fairest pricing for traders and LPs.'
const HYPERLIQUID =
	'Hyperliquid is a Layer 1 blockchain best known for perpetual futures and spot trading. Beyond its flagship decentralized exchange (DEX), the ecosystem supports borrowing, lending, RWAs, and a full-fledged EVM.'

describe('protocolDescriptionSentence', () => {
	test('uses the first stored sentence and leaves a description with no period intact', () => {
		expect(protocolDescriptionSentence(AAVE)).toBe(AAVE)
		expect(protocolDescriptionSentence(HYPERLIQUID)).toBe(
			'Hyperliquid is a Layer 1 blockchain best known for perpetual futures and spot trading.'
		)
		expect(protocolDescriptionSentence('  Aave\nis   a protocol.  ')).toBe('Aave is a protocol.')
		expect(protocolDescriptionSentence('   ')).toBe('')
		expect(protocolDescriptionSentence(null)).toBe('')
	})
})

describe('buildProtocolMetaDescription', () => {
	const fallback = 'Track Aave on DefiLlama. Including TVL, Fees'

	test('appends the TVL clause when the sentence leaves room', () => {
		expect(
			buildProtocolMetaDescription({
				description: AAVE,
				fallback,
				metricClause: protocolMetaMetricClause({
					tvl: 18_600_000_000,
					tvlIsHero: true,
					volume30d: 1_000_000_000,
					fees30d: 50_000_000
				})
			})
		).toBe(`${AAVE}. TVL is $18.6b.`)
	})

	test('keeps a sentence that already fills the snippet, and the chart list when there is no description', () => {
		const clause = protocolMetaMetricClause({
			tvl: 18_600_000_000,
			tvlIsHero: true,
			volume30d: null,
			fees30d: null
		})
		expect(buildProtocolMetaDescription({ description: VEST, fallback, metricClause: clause })).toBe(VEST)
		expect(buildProtocolMetaDescription({ description: '  ', fallback, metricClause: clause })).toBe(fallback)
		expect(buildProtocolMetaDescription({ description: null, fallback, metricClause: clause })).toBe(fallback)
	})

	test('uses 30-day volume when TVL is not the hero, and fees when there is no volume', () => {
		expect(
			protocolMetaMetricClause({
				tvl: 10,
				tvlIsHero: false,
				volume30d: 4_200_000_000,
				fees30d: 89_100_000
			})
		).toBe(' 30-day volume is $4.2b.')
		expect(
			protocolMetaMetricClause({
				tvl: null,
				tvlIsHero: false,
				volume30d: null,
				fees30d: 89_100_000
			})
		).toBe(' Fees were $89.1m in the last 30 days.')
	})

	test('cuts a sentence longer than the meta cap at the last word that fits', () => {
		const sentence = `${'Word '.repeat(40).trim()}.`
		expect(sentence.length).toBeGreaterThan(155)
		const meta = buildProtocolMetaDescription({
			description: sentence,
			fallback,
			metricClause: ' TVL is $18.6b.'
		})
		expect(meta.length).toBeLessThanOrEqual(155)
		expect(meta.endsWith(' ')).toBe(false)
		expect(sentence.startsWith(meta)).toBe(true)
		expect(meta.includes('TVL')).toBe(false)
	})
})
