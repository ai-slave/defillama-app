import { formatUsd } from '~/utils/numberFormat'

const META_DESCRIPTION_LIMIT = 155
// A sentence this short still leaves room for one metric clause inside the meta cap.
const METRIC_CLAUSE_SENTENCE_LIMIT = 120

const COMPACT_USD = { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' } as const

/** The stored description as the one sentence search should quote. Later sentences stay in Protocol Information. */
export function protocolDescriptionSentence(description: string | null | undefined): string {
	const collapsed = description?.replace(/\s+/g, ' ').trim() ?? ''
	if (!collapsed) return ''
	const end = /[.!?](?=\s|$)/.exec(collapsed)
	if (!end) return collapsed
	return collapsed.slice(0, end.index + 1)
}

function cutAtLastWord(value: string, max: number): string {
	if (value.length <= max) return value
	const boundary = value.lastIndexOf(' ', max)
	return (boundary > 0 ? value.slice(0, boundary) : value.slice(0, max)).trimEnd().replace(/[,:;]+$/, '')
}

function compactUsd(value: number | null): string | null {
	if (value == null) return null
	return formatUsd(value, COMPACT_USD)
}

/** One metric clause, the same fact as the open TVL, volume, or fees answer. */
export function protocolMetaMetricClause(input: {
	tvl: number | null
	tvlIsHero: boolean
	volume30d: number | null
	fees30d: number | null
}): string | null {
	if (input.tvlIsHero) {
		const tvl = compactUsd(input.tvl)
		return tvl ? ` TVL is ${tvl}.` : null
	}
	const volume = compactUsd(input.volume30d)
	if (volume) return ` 30-day volume is ${volume}.`
	const fees = compactUsd(input.fees30d)
	if (fees) return ` Fees were ${fees} in the last 30 days.`
	return null
}

/**
 * The sentence under the H1, plus a metric clause when the sentence is short enough that both fit.
 * A sentence that already fills the snippet keeps its words. An empty description keeps the chart-list fallback.
 */
export function buildProtocolMetaDescription(input: {
	description: string | null | undefined
	fallback: string
	metricClause: string | null
}): string {
	const sentence = protocolDescriptionSentence(input.description)
	if (!sentence) return input.fallback

	if (sentence.length <= METRIC_CLAUSE_SENTENCE_LIMIT && input.metricClause) {
		const lead = /[.!?]$/.test(sentence) ? sentence : `${sentence}.`
		const withMetric = `${lead}${input.metricClause}`
		if (withMetric.length <= META_DESCRIPTION_LIMIT) return withMetric
	}

	return cutAtLastWord(sentence, META_DESCRIPTION_LIMIT)
}
