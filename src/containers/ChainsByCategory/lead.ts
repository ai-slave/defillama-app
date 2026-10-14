import { formatDate } from '~/utils/dateFormat'
import { formatUsd, USD_LOWERCASE_MILLIONS_OPTIONS } from '~/utils/numberFormat'

export const CHAIN_TVL_DEFINITION =
	'Total value locked (TVL) is the dollar value of crypto deposited in DeFi protocols.'

type NamedTvl = { name: string; tvl: number | null }

function topByTvl(rows: ReadonlyArray<NamedTvl>, count: number): Array<{ name: string; tvl: number }> | null {
	const ranked: Array<{ name: string; tvl: number }> = []
	for (const row of rows) {
		if (row.tvl == null) continue
		ranked.push({ name: row.name, tvl: row.tvl })
	}
	ranked.sort((a, b) => b.tvl - a.tvl || a.name.localeCompare(b.name))
	if (ranked.length < count) return null
	return ranked.slice(0, count)
}

/** The chains hub sentence. The definition still leads when the top three rows are missing. */
export function chainsIntro(dateSec: number, chains: ReadonlyArray<NamedTvl>): string {
	const date = formatDate(dateSec, { input: 'seconds' })
	const leaders = topByTvl(chains, 3)
	const first = leaders?.[0]
	const second = leaders?.[1]
	const third = leaders?.[2]
	if (!date || !first || !second || !third) return CHAIN_TVL_DEFINITION
	const firstTvl = formatUsd(first.tvl, USD_LOWERCASE_MILLIONS_OPTIONS)
	const secondTvl = formatUsd(second.tvl, USD_LOWERCASE_MILLIONS_OPTIONS)
	const thirdTvl = formatUsd(third.tvl, USD_LOWERCASE_MILLIONS_OPTIONS)
	if (!firstTvl || !secondTvl || !thirdTvl) return CHAIN_TVL_DEFINITION
	return `${CHAIN_TVL_DEFINITION} On ${date} ${first.name} led with ${firstTvl}, ahead of ${second.name} at ${secondTvl} and ${third.name} at ${thirdTvl}.`
}
