import { slug } from '~/utils'
import { formatDate } from '~/utils/dateFormat'
import { formatUsd, formatCompactNumber, formatNumber, formatPercent } from '~/utils/numberFormat'
import type { IProtocolFaqAnswerPart, IProtocolFaqItem } from './types'

const MAX_LINKED_CHAINS = 5
const MAX_LINKED_CHILDREN = 5
const MAX_LINKED_PEERS = 10

export interface ProtocolFaqChain {
	name: string
	tvl: number | null
	href: string | null
}

export interface ProtocolFaqComparison {
	category: string
	categoryHref: string
	rank: number
	protocolCount: number
	totalTvl: number
	sharePercent: number
	peers: Array<{ name: string; href: string; tvl: number }>
}

export interface ProtocolFaqChild {
	name: string
	href: string
	category: string | null
	chains: string[]
}

interface ProtocolFaqToken {
	symbol: string
	marketCapRank: number | null
	currentPrice: number | null
	priceChange7d: number | null
	priceChange30d: number | null
	marketCap: number | null
	fdv: number | null
	circulatingSupply: number | null
	totalSupply: number | null
	maxSupply: number | null
	ath: number | null
	athDate: string | null
	tokenPageRoute: string | null
}

export interface ProtocolFaqContext {
	name: string
	tvl: {
		current: number | null
		change30d: number | null
	}
	chains: ProtocolFaqChain[]
	fees: {
		fees30d: number | null
		revenue30d: number | null
		annualizedFees: number | null
		annualizedRevenue: number | null
	}
	token: ProtocolFaqToken | null
	comparison: ProtocolFaqComparison | null
	children: ProtocolFaqChild[]
	useChildrenQuestion: boolean
	treasury: {
		ownTokens: number | null
		stablecoins: number | null
		majors: number | null
		others: number | null
		total: number | null
	} | null
	hacks: Array<{
		date: number | null
		amountUsd: number | null
		classification: string | null
	}>
	metrics: {
		borrowed: number | null
		dexVolume30d: number | null
		perpVolume30d: number | null
		openInterest: number | null
		yieldPoolCount: number | null
		averageApy: number | null
	}
}

interface ProtocolFaqRelationshipInput {
	protocolId: string
	protocolName: string
	category: string | null
	isParent: boolean
	chains: string[]
	protocols: Array<{
		name: string
		slug?: string
		defillamaId: string
		category?: string
		chains: string[]
		tvl: number | null
		parentProtocol?: string
		deprecated?: boolean
	}>
}

export function buildProtocolFaqRelationship({
	protocolId,
	protocolName,
	category,
	isParent,
	chains,
	protocols
}: ProtocolFaqRelationshipInput): {
	comparison: ProtocolFaqComparison | null
	children: ProtocolFaqChild[]
	useChildrenQuestion: boolean
} {
	const rawChildren: Array<{
		name: string
		slug?: string
		category: string | null
		chains: string[]
		tvl: number | null
	}> = []
	const rows: Array<{
		id: string
		name: string
		tvl: number
		href: string
		commonChains: number
	}> = []
	const normalizedCategory = category?.toLowerCase() ?? null
	const chainSet = new Set(chains)
	let currentParentTvl = 0

	for (const protocol of protocols) {
		if (protocol.deprecated) continue
		if (protocol.parentProtocol === protocolId) {
			rawChildren.push({
				name: protocol.name,
				...(protocol.slug !== undefined ? { slug: protocol.slug } : {}),
				category: protocol.category ?? null,
				chains: protocol.chains,
				tvl: protocol.tvl ?? null
			})
		}
		if (!normalizedCategory || !protocol.category || protocol.category.toLowerCase() !== normalizedCategory) continue

		// Keep peers at product level; only aggregate the current parent so its own children are not competitors.
		if (isParent && protocol.parentProtocol === protocolId) {
			currentParentTvl += protocol.tvl ?? 0
			continue
		}

		rows.push({
			id: protocol.defillamaId,
			name: protocol.name,
			tvl: protocol.tvl ?? 0,
			href: `/protocol/${protocol.slug ?? slug(protocol.name)}`,
			commonChains: protocol.chains.filter((chain) => chainSet.has(chain)).length
		})
	}

	if (isParent && normalizedCategory) {
		rows.push({
			id: protocolId,
			name: protocolName,
			tvl: currentParentTvl,
			href: `/protocol/${slug(protocolName)}`,
			commonChains: chains.length
		})
	}

	const children = rawChildren
		.toSorted((a, b) => (b.tvl ?? 0) - (a.tvl ?? 0))
		.map((protocol) => ({
			name: protocol.name,
			href: `/protocol/${protocol.slug ?? slug(protocol.name)}`,
			category: protocol.category,
			chains: protocol.chains
		}))
	const childCategories = new Set(
		rawChildren.map((child) => child.category).filter((value): value is string => value != null)
	)
	const useChildrenQuestion = isParent && children.length > 0 && childCategories.size !== 1

	if (!category || useChildrenQuestion) {
		return { comparison: null, children, useChildrenQuestion }
	}

	rows.sort((a, b) => b.tvl - a.tvl)
	const currentIndex = rows.findIndex((row) => row.id === protocolId)
	if (currentIndex === -1) {
		return {
			comparison: null,
			children,
			useChildrenQuestion: isParent && children.length > 0
		}
	}

	const totalTvl = rows.reduce((sum, row) => sum + row.tvl, 0)
	const currentRow = rows[currentIndex]
	if (currentRow === undefined) {
		return {
			comparison: null,
			children,
			useChildrenQuestion: isParent && children.length > 0
		}
	}
	const currentTvl = currentRow.tvl
	if (totalTvl <= 0) {
		return {
			comparison: null,
			children,
			useChildrenQuestion: isParent && children.length > 0
		}
	}

	const peers = rows
		.filter((row) => row.id !== protocolId)
		.toSorted((a, b) => b.commonChains - a.commonChains || b.tvl - a.tvl)

	return {
		comparison: {
			category,
			categoryHref: `/protocols/${slug(category)}`,
			rank: currentIndex + 1,
			protocolCount: rows.length,
			totalTvl,
			sharePercent: (currentTvl / totalTvl) * 100,
			peers: peers.slice(0, MAX_LINKED_PEERS).map((row) => ({ name: row.name, href: row.href, tvl: row.tvl }))
		},
		children,
		useChildrenQuestion: false
	}
}

export function buildProtocolFaq(context: ProtocolFaqContext): IProtocolFaqItem[] {
	const candidates = [
		buildTvlQuestion(context),
		buildChainsQuestion(context),
		buildFeesQuestion(context),
		buildTokenValuationQuestion(context),
		buildTokenPerformanceQuestion(context),
		buildRelationshipQuestion(context),
		buildMetricSpecificQuestion(context),
		buildTreasuryQuestion(context),
		buildSecurityQuestion(context)
	]

	return candidates.filter((item): item is IProtocolFaqItem => item != null)
}

function text(value: string): IProtocolFaqAnswerPart {
	return { text: value }
}

function linkedText(value: string, href: string | null | undefined): IProtocolFaqAnswerPart {
	return href ? { text: value, href } : { text: value }
}

function appendLinkedList(parts: IProtocolFaqAnswerPart[], items: Array<{ name: string; href?: string | null }>): void {
	for (const [index, item] of items.entries()) {
		if (index > 0) {
			parts.push(text(index === items.length - 1 ? (items.length === 2 ? ' and ' : ', and ') : ', '))
		}
		parts.push(linkedText(item.name, item.href))
	}
}

function possessive(name: string): string {
	return name.endsWith('s') ? `${name}'` : `${name}'s`
}

function formatPercentMagnitude(value: number): string {
	return formatPercent(Math.abs(value), {
		input: 'percent',
		maximumFractionDigits: 1
	})
}

function buildTvlQuestion(context: ProtocolFaqContext): IProtocolFaqItem | null {
	if (context.tvl.current == null) return null

	const answer = [
		`${context.name} currently has ${formatUsd(context.tvl.current, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })} in total value locked`
	]
	if (context.tvl.change30d != null) {
		const direction = context.tvl.change30d >= 0 ? 'increased' : 'decreased'
		answer.push(`. TVL has ${direction} ${formatPercentMagnitude(context.tvl.change30d)} over the past 30 days`)
	}
	answer.push('.')

	return {
		id: 'tvl',
		question: `What is ${possessive(context.name)} TVL?`,
		answer: [text(answer.join(''))]
	}
}

function buildChainsQuestion(context: ProtocolFaqContext): IProtocolFaqItem | null {
	if (context.chains.length === 0) return null

	const answer: IProtocolFaqAnswerPart[] = []
	if (context.chains.length === 1) {
		for (const chain of context.chains) {
			answer.push(text(`${context.name} operates on `), linkedText(chain.name, chain.href), text('.'))
		}
	} else {
		answer.push(text(`${context.name} operates on ${formatNumber(context.chains.length)} chains: `))
		appendLinkedList(answer, context.chains.slice(0, MAX_LINKED_CHAINS))
		if (context.chains.length > MAX_LINKED_CHAINS) {
			answer.push(text(` and ${context.chains.length - MAX_LINKED_CHAINS} others`))
		}
		answer.push(text('.'))
	}

	const chainsWithTvl = context.chains.filter((chain) => chain.tvl != null && chain.tvl > 0)
	const totalChainTvl = chainsWithTvl.reduce((sum, chain) => sum + (chain.tvl ?? 0), 0)
	const largestChain = chainsWithTvl.toSorted((a, b) => (b.tvl ?? 0) - (a.tvl ?? 0))[0]
	if (largestChain && totalChainTvl > 0) {
		const share = ((largestChain.tvl ?? 0) / totalChainTvl) * 100
		answer.push(
			text(' '),
			linkedText(largestChain.name, largestChain.href),
			text(` holds the largest share at ${formatPercentMagnitude(share)}.`)
		)
	}

	return {
		id: 'chains',
		question: `What chains does ${context.name} operate on?`,
		answer
	}
}

function buildFeesQuestion(context: ProtocolFaqContext): IProtocolFaqItem | null {
	const { fees30d, revenue30d, annualizedFees, annualizedRevenue } = context.fees
	if (fees30d == null && revenue30d == null) return null

	const answer: string[] = []
	if (fees30d != null)
		answer.push(
			`Over the past 30 days, ${context.name} generated ${formatUsd(fees30d, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })} in fees.`
		)
	if (revenue30d != null) {
		answer.push(
			fees30d != null
				? ` Of that, ${formatUsd(revenue30d, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })} was protocol revenue.`
				: `Over the past 30 days, ${context.name} generated ${formatUsd(revenue30d, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })} in protocol revenue.`
		)
	}
	if (annualizedFees != null || annualizedRevenue != null) {
		const annualized: string[] = []
		if (annualizedFees != null)
			annualized.push(
				`${formatUsd(annualizedFees, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })} in fees`
			)
		if (annualizedRevenue != null)
			annualized.push(
				`${formatUsd(annualizedRevenue, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })} in revenue`
			)
		answer.push(` Based on the trailing year, the annualized rate is ${annualized.join(' and ')}.`)
	}

	return {
		id: 'fees-revenue',
		question:
			fees30d != null && revenue30d != null
				? `How much has ${context.name} generated in fees and revenue?`
				: fees30d != null
					? `How much has ${context.name} generated in fees?`
					: `How much revenue has ${context.name} generated?`,
		answer: [text(answer.join(''))]
	}
}

function buildTokenValuationQuestion(context: ProtocolFaqContext): IProtocolFaqItem | null {
	const token = context.token
	if (!token) return null
	const hasValuation =
		token.currentPrice != null ||
		token.marketCap != null ||
		token.fdv != null ||
		token.circulatingSupply != null ||
		token.totalSupply != null ||
		token.maxSupply != null
	if (!hasValuation) return null

	const answer: IProtocolFaqAnswerPart[] = []
	if (token.currentPrice != null) {
		answer.push(
			linkedText(token.symbol, token.tokenPageRoute),
			text(
				` is currently trading at ${formatUsd(token.currentPrice, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}.`
			)
		)
	}
	if (token.marketCap != null) {
		answer.push(
			text(
				` Its circulating market capitalization is ${formatUsd(token.marketCap, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}`
			),
			text(token.marketCapRank != null ? `, ranking it #${formatNumber(token.marketCapRank)}` : ''),
			text('.')
		)
	}
	if (token.fdv != null)
		answer.push(
			text(
				` Its fully diluted valuation is ${formatUsd(token.fdv, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}.`
			)
		)
	if (token.circulatingSupply != null || token.totalSupply != null || token.maxSupply != null) {
		const supply: string[] = []
		if (token.circulatingSupply != null)
			supply.push(
				`${formatCompactNumber(token.circulatingSupply, { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })} circulating`
			)
		if (token.totalSupply != null)
			supply.push(
				`${formatCompactNumber(token.totalSupply, { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })} total supply`
			)
		if (token.maxSupply != null)
			supply.push(
				`${formatCompactNumber(token.maxSupply, { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })} maximum supply`
			)
		answer.push(text(` Supply currently stands at ${supply.join(', ')}.`))
	}

	return {
		id: 'token-valuation',
		question: `What is the ${token.symbol} token price and valuation?`,
		answer
	}
}

function buildTokenPerformanceQuestion(context: ProtocolFaqContext): IProtocolFaqItem | null {
	const token = context.token
	if (!token || (token.priceChange7d == null && token.priceChange30d == null && token.ath == null)) return null

	const answer: string[] = []
	if (token.priceChange7d != null) {
		answer.push(
			`${token.symbol} is ${token.priceChange7d >= 0 ? 'up' : 'down'} ${formatPercentMagnitude(token.priceChange7d)} over the past 7 days`
		)
	}
	if (token.priceChange30d != null) {
		answer.push(
			`${answer.length > 0 ? ' and' : `${token.symbol} is`} ${token.priceChange30d >= 0 ? 'up' : 'down'} ${formatPercentMagnitude(token.priceChange30d)} over the past 30 days`
		)
	}
	if (answer.length > 0) answer.push('.')
	if (token.ath != null) {
		const athDate = formatDate(token.athDate)
		answer.push(
			` Its all-time high is ${formatUsd(token.ath, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}${athDate ? `, reached on ${athDate}` : ''}.`
		)
		if (token.currentPrice != null && token.ath > 0 && token.currentPrice <= token.ath) {
			answer.push(
				` The token is currently ${formatPercentMagnitude(((token.ath - token.currentPrice) / token.ath) * 100)} below that level.`
			)
		}
	}

	return {
		id: 'token-performance',
		question: `How has ${token.symbol} performed recently?`,
		answer: [text(answer.join(''))]
	}
}

function buildRelationshipQuestion(context: ProtocolFaqContext): IProtocolFaqItem | null {
	if (context.useChildrenQuestion && context.children.length > 0) {
		const answer: IProtocolFaqAnswerPart[] = [
			text(`${context.name} is a parent protocol whose tracked products include `)
		]
		appendLinkedList(answer, context.children.slice(0, MAX_LINKED_CHILDREN))
		if (context.children.length > MAX_LINKED_CHILDREN) {
			answer.push(text(` and ${context.children.length - MAX_LINKED_CHILDREN} others`))
		}
		answer.push(text('.'))
		return {
			id: 'children',
			question: `Which protocols are included in ${context.name}?`,
			answer
		}
	}

	const comparison = context.comparison
	if (!comparison) return null
	const answer: IProtocolFaqAnswerPart[] = [
		text('Among '),
		linkedText(`${comparison.category} protocols`, comparison.categoryHref)
	]
	answer.push(
		text(
			` tracked by DefiLlama, ${context.name} ranks #${formatNumber(comparison.rank)} by TVL. The category holds ${formatUsd(comparison.totalTvl, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })} across ${formatNumber(comparison.protocolCount)} protocol${comparison.protocolCount === 1 ? '' : 's'}, and ${context.name} accounts for ${formatPercentMagnitude(comparison.sharePercent)} of that total.`
		)
	)
	if (comparison.peers.length > 0) {
		answer.push(text(' Other leading protocols include '))
		appendLinkedList(answer, comparison.peers)
		answer.push(text('.'))
	}

	return {
		id: 'comparison',
		question: `How does ${possessive(context.name)} TVL compare to similar protocols?`,
		answer
	}
}

function buildMetricSpecificQuestion(context: ProtocolFaqContext): IProtocolFaqItem | null {
	const protocolSlug = slug(context.name)
	if (context.metrics.borrowed != null) {
		return {
			id: 'active-loans',
			question: `How much has been borrowed through ${context.name}?`,
			answer: [
				text(
					`${context.name} currently has ${formatUsd(context.metrics.borrowed, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })} in `
				),
				linkedText('active loans', `/protocol/active-loans/${protocolSlug}`),
				text('.')
			]
		}
	}
	if (context.metrics.dexVolume30d != null) {
		return {
			id: 'dex-volume',
			question: `How much trading volume does ${context.name} process?`,
			answer: [
				text(
					`${context.name} processed ${formatUsd(context.metrics.dexVolume30d, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })} in `
				),
				linkedText('DEX volume', `/protocol/dexs/${protocolSlug}`),
				text(' over the past 30 days.')
			]
		}
	}
	if (context.metrics.perpVolume30d != null) {
		return {
			id: 'perp-volume',
			question: `How much perpetual futures volume does ${context.name} process?`,
			answer: [
				text(
					`${context.name} processed ${formatUsd(context.metrics.perpVolume30d, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })} in `
				),
				linkedText('perpetual futures volume', `/protocol/perps/${protocolSlug}`),
				text(' over the past 30 days.')
			]
		}
	}
	if (context.metrics.openInterest != null) {
		return {
			id: 'open-interest',
			question: `What is ${possessive(context.name)} open interest?`,
			answer: [
				text(
					`${context.name} currently has ${formatUsd(context.metrics.openInterest, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })} in open interest.`
				)
			]
		}
	}
	if (context.metrics.yieldPoolCount != null) {
		return {
			id: 'yields',
			question: `How many yield pools does ${context.name} have?`,
			answer: [
				text(
					`DefiLlama tracks ${formatNumber(context.metrics.yieldPoolCount)} ${context.name} yield pool${context.metrics.yieldPoolCount === 1 ? '' : 's'}${context.metrics.averageApy != null ? ` with an average APY of ${formatPercentMagnitude(context.metrics.averageApy)}` : ''}.`
				)
			]
		}
	}

	return null
}

function buildTreasuryQuestion(context: ProtocolFaqContext): IProtocolFaqItem | null {
	const treasury = context.treasury
	if (!treasury || treasury.total == null) return null

	const breakdown: string[] = []
	if (treasury.stablecoins != null && treasury.stablecoins > 0) {
		breakdown.push(
			`${formatUsd(treasury.stablecoins, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })} in stablecoins`
		)
	}
	if (treasury.majors != null && treasury.majors > 0)
		breakdown.push(
			`${formatUsd(treasury.majors, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })} in major assets`
		)
	if (treasury.ownTokens != null && treasury.ownTokens > 0) {
		breakdown.push(
			`${formatUsd(treasury.ownTokens, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })} in its own tokens`
		)
	}
	if (treasury.others != null && treasury.others > 0)
		breakdown.push(
			`${formatUsd(treasury.others, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })} in other assets`
		)

	return {
		id: 'treasury',
		question: `Does ${context.name} have a treasury?`,
		answer: [
			text(
				`${context.name} has a tracked treasury currently valued at ${formatUsd(treasury.total, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}${breakdown.length > 0 ? `. Its holdings include ${breakdown.join(', ')}` : ''}.`
			)
		]
	}
}

function buildSecurityQuestion(context: ProtocolFaqContext): IProtocolFaqItem | null {
	if (context.hacks.length === 0) return null
	let latest: ProtocolFaqContext['hacks'][number] | null = null
	for (const hack of context.hacks) {
		if (latest === null || (hack.date ?? 0) > (latest.date ?? 0)) latest = hack
	}
	if (latest === null) return null
	const latestDate = latest.date == null ? null : formatDate(latest.date, { input: 'seconds' })
	const answer: IProtocolFaqAnswerPart[] = [
		text(`${context.name} has ${formatNumber(context.hacks.length)} recorded `),
		linkedText(`security incident${context.hacks.length === 1 ? '' : 's'}`, '/hacks'),
		text('.')
	]
	if (latestDate || latest.amountUsd != null || latest.classification) {
		answer.push(text(` The most recent incident${latestDate ? ` occurred on ${latestDate}` : ''}`))
		if (latest.amountUsd != null)
			answer.push(
				text(
					` and involved ${formatUsd(latest.amountUsd, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}`
				)
			)
		if (latest.classification) answer.push(text(`. It was classified as ${latest.classification}`))
		answer.push(text('.'))
	}

	return {
		id: 'security',
		question: `Has ${context.name} ever been exploited?`,
		answer
	}
}
