import { formatDate } from '~/utils/dateFormat'
import { formatUsd, USD_LOWERCASE_MILLIONS_OPTIONS } from '~/utils/numberFormat'

export const DEX_AGGREGATOR_DEFINITION = 'A DEX aggregator routes swaps across exchanges for a better price.'
export const DEX_AGGREGATOR_QUESTION = 'What is a DEX aggregator?'
export const DEX_AGGREGATOR_VOLUME_QUESTION = 'Which aggregators have the most 24h volume?'

/** The visible FAQ. The volume question is omitted when the page has no ranked total. */
export function dexAggregatorFaq(volumeAnswer: string | null): Array<{ question: string; answer: string }> {
	const questions = [{ question: DEX_AGGREGATOR_QUESTION, answer: DEX_AGGREGATOR_DEFINITION }]
	if (volumeAnswer) questions.push({ question: DEX_AGGREGATOR_VOLUME_QUESTION, answer: volumeAnswer })
	return questions
}
export const PERP_DEFINITION = 'A perpetual DEX lists perpetual futures markets.'

type ProtocolVolume = { name: string; total24h: number | null }

function topByVolume(
	protocols: ReadonlyArray<ProtocolVolume>,
	count: number
): Array<{ name: string; total24h: number }> | null {
	const ranked: Array<{ name: string; total24h: number }> = []
	for (const protocol of protocols) {
		if (protocol.total24h == null) continue
		ranked.push({ name: protocol.name, total24h: protocol.total24h })
	}
	ranked.sort((a, b) => b.total24h - a.total24h || a.name.localeCompare(b.name))
	if (ranked.length < count) return null
	return ranked.slice(0, count)
}

function usd(value: number): string | null {
	return formatUsd(value, USD_LOWERCASE_MILLIONS_OPTIONS)
}

/** Definition first. The volume clause names the current top three when the page has them. */
export function dexAggregatorIntro(input: {
	dateSec: number
	total24h: number | null
	protocols: ReadonlyArray<ProtocolVolume>
}): { intro: string; volumeAnswer: string | null } {
	const date = formatDate(input.dateSec, { input: 'seconds' })
	const leaders = topByVolume(input.protocols, 3)
	const total = input.total24h == null ? null : usd(input.total24h)
	const first = leaders?.[0]
	const second = leaders?.[1]
	const third = leaders?.[2]
	const firstUsd = first ? usd(first.total24h) : null
	const secondUsd = second ? usd(second.total24h) : null
	const thirdUsd = third ? usd(third.total24h) : null
	if (!date || !total || !first || !second || !third || !firstUsd || !secondUsd || !thirdUsd) {
		return { intro: DEX_AGGREGATOR_DEFINITION, volumeAnswer: null }
	}
	const volumeAnswer = `On ${date}, tracked DEX aggregator volume was ${total} in 24 hours. ${first.name} led at ${firstUsd}, then ${second.name} at ${secondUsd} and ${third.name} at ${thirdUsd}.`
	return { intro: `${DEX_AGGREGATOR_DEFINITION} ${volumeAnswer}`, volumeAnswer }
}

export function perpIntro(input: { dateSec: number; protocols: ReadonlyArray<ProtocolVolume> }): string {
	const date = formatDate(input.dateSec, { input: 'seconds' })
	const leader = topByVolume(input.protocols, 1)?.[0]
	const amount = leader ? usd(leader.total24h) : null
	if (!date || !leader || !amount) return PERP_DEFINITION
	return `${PERP_DEFINITION} On ${date} ${leader.name} led 24h volume at ${amount}.`
}

export function dexVolumeIntro(input: { dateSec: number; protocols: ReadonlyArray<ProtocolVolume> }): string | null {
	const date = formatDate(input.dateSec, { input: 'seconds' })
	const leaders = topByVolume(input.protocols, 3)
	const first = leaders?.[0]
	const second = leaders?.[1]
	const third = leaders?.[2]
	const amount = first ? usd(first.total24h) : null
	if (!date || !first || !second || !third || !amount) return null
	return `On ${date} ${first.name} led DEX volume at ${amount}, ahead of ${second.name} and ${third.name}.`
}
