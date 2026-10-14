import { expect, test } from 'vitest'
import { getMainSiteIrBaseHref } from '~/containers/Investors/mainSiteDashboards'
import {
	buildProtocolMetaDescription,
	getProtocolLayoutSeo,
	protocolDescriptionSentence,
	resolveProtocolDashboards,
	showsActiveLoansTvlNotice
} from '../layoutSeo'

test.each([
	{ behavior: 'the information tab is indexable', name: 'Aave', tab: 'information', canonicalUrl: '/protocol/aave' },
	{
		behavior: 'Active Loans is indexable under its own route',
		name: 'Aave',
		tab: 'borrowed',
		canonicalUrl: '/protocol/active-loans/aave'
	},
	{
		behavior: 'unlocks canonicalizes to the unlocks page',
		name: 'Aave',
		tab: 'unlocks',
		canonicalUrl: '/unlocks/aave'
	},
	{ behavior: 'the TVL tab is noindex without a canonical', name: 'Aave', tab: 'tvl', canonicalUrl: null },
	{ behavior: 'the fees tab is noindex without a canonical', name: 'Aave', tab: 'fees', canonicalUrl: null },
	{
		behavior: 'a CEX canonicalizes to its exchange page',
		name: 'Binance CEX',
		tab: 'information',
		isCEX: true,
		canonicalUrl: '/cex/binance-cex'
	}
] as const)('$behavior', ({ name, tab, canonicalUrl, ...options }) => {
	const seo = getProtocolLayoutSeo({ name, tab, isCEX: 'isCEX' in options && options.isCEX })
	expect({ canonicalUrl: seo.canonicalUrl, noIndex: seo.noIndex }).toEqual({
		canonicalUrl,
		noIndex: canonicalUrl == null
	})
})

test('configured protocols stay noindex while keeping their canonical', () => {
	const seo = getProtocolLayoutSeo({ name: 'Defi Swap', tab: 'information' })
	expect({ canonicalUrl: seo.canonicalUrl, noIndex: seo.noIndex }).toEqual({
		canonicalUrl: '/protocol/defi-swap',
		noIndex: true
	})
})

test('the meta description is the stored sentence, plus one metric when both fit', () => {
	const aave = 'Aave is an Open Source and Non-Custodial protocol to earn interest on deposits and borrow assets'
	const vest =
		'Vest Exchange is a next generation Perps DEX that ensures the most capital efficient liquidity, and fairest pricing for traders and LPs.'
	const fallback = 'Track Aave on DefiLlama. Including TVL, Fees'
	const metrics = { tvl: 18_600_000_000, tvlIsHero: true, volume30d: 4_200_000_000, fees30d: 89_100_000 }
	expect(buildProtocolMetaDescription({ description: aave, fallback, ...metrics })).toBe(`${aave}. TVL is $18.6b.`)
	expect(buildProtocolMetaDescription({ description: vest, fallback, ...metrics })).toBe(vest)
	expect(buildProtocolMetaDescription({ description: null, fallback, ...metrics })).toBe(fallback)
	expect(buildProtocolMetaDescription({ description: '  ', fallback, ...metrics })).toBe(fallback)
	expect(
		protocolDescriptionSentence(
			'Hyperliquid is a Layer 1 blockchain best known for perpetual futures and spot trading. Beyond its flagship exchange.'
		)
	).toBe('Hyperliquid is a Layer 1 blockchain best known for perpetual futures and spot trading.')
	expect(
		buildProtocolMetaDescription({
			description:
				'Hyperliquid is a Layer 1 blockchain best known for perpetual futures and spot trading. Beyond its flagship exchange.',
			fallback,
			...metrics,
			tvlIsHero: false
		})
	).toBe(
		'Hyperliquid is a Layer 1 blockchain best known for perpetual futures and spot trading. 30-day volume is $4.2b.'
	)
	expect(
		buildProtocolMetaDescription({
			description: aave,
			fallback,
			tvl: null,
			tvlIsHero: false,
			volume30d: null,
			fees30d: 89_100_000
		})
	).toBe(`${aave}. Fees were $89.1m in the last 30 days.`)
	const long = `${'Word '.repeat(40).trim()}.`
	const cut = buildProtocolMetaDescription({ description: long, fallback, ...metrics })
	expect(cut.length).toBeLessThanOrEqual(155)
	expect(long.startsWith(cut)).toBe(true)
	expect(cut.includes('TVL')).toBe(false)
})

test('empty SEO strings fall back to the protocol title and description', () => {
	const seo = getProtocolLayoutSeo({ name: 'Aave', tab: 'information', seoTitle: '', seoDescription: '' })
	expect(seo.title).toBe('Aave Protocol Overview - DefiLlama')
	expect(seo.description).toBe(
		'Track Aave metrics on DefiLlama. DefiLlama is committed to providing accurate data without ads or sponsored content, as well as transparency.'
	)
	expect(getProtocolLayoutSeo({ name: 'Aave', tab: 'information', seoTitle: 'Aave - TVL' }).title).toBe('Aave - TVL')
})

test('explains how to add active loans to TVL on every tab except Active Loans', () => {
	expect(showsActiveLoansTvlNotice('information', 'Uncollateralized Lending')).toBe(true)
	expect(showsActiveLoansTvlNotice('tvl', 'RWA Lending')).toBe(true)
	expect(showsActiveLoansTvlNotice('borrowed', 'Uncollateralized Lending')).toBe(false)
	expect(showsActiveLoansTvlNotice('information', 'Lending')).toBe(false)
})

function dashboards(
	name: string,
	options: { otherProtocols?: Array<string>; userId?: string; isLlama?: boolean } = {}
) {
	const { investorRelations, announcement } = resolveProtocolDashboards({
		name,
		otherProtocols: options.otherProtocols,
		user: { id: options.userId, isLlama: options.isLlama ?? false }
	})
	return {
		tab: investorRelations
			? { label: investorRelations.tabLabel, href: getMainSiteIrBaseHref(investorRelations) }
			: null,
		announcement: announcement?.resolvedHref ?? null
	}
}

test.each(['Vesper', 'Metronome', 'Metronome Synth'])(
	'%s announces the external Odyssey enterprise dashboard',
	(name) => {
		expect(dashboards(name)).toEqual({ tab: null, announcement: 'https://enterprise.defillama.com/odyssey-ecosystem' })
	}
)

test('Odyssey Finance gets the in-page enterprise tab instead of the external announcement', () => {
	expect(dashboards('Odyssey Finance')).toEqual({
		tab: { label: 'Enterprise', href: '/protocol/investor-relations/odyssey-finance' },
		announcement: null
	})
})

test('Uniswap and its child protocols show the Deep Dive tab for every visitor', () => {
	const deepDive = { tab: { label: 'Deep Dive', href: '/protocol/deep-dive/uniswap' }, announcement: null }
	expect(dashboards('Uniswap')).toEqual(deepDive)
	expect(dashboards('Uniswap', { isLlama: true })).toEqual(deepDive)
	expect(dashboards('Uniswap V3', { otherProtocols: ['Uniswap', 'Uniswap V2', 'Uniswap V3'] })).toEqual(deepDive)
})

test('a CEX never shows a protocol dashboard tab', () => {
	expect(resolveProtocolDashboards({ name: 'Uniswap', isCEX: true, user: { isLlama: true } }).investorRelations).toBe(
		null
	)
})
