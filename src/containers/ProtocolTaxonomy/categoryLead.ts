import { formatDate } from '~/utils/dateFormat'
import { formatUsd, USD_LOWERCASE_MILLIONS_OPTIONS } from '~/utils/numberFormat'

export const CATEGORY_DEFINITION = 'DeFi categories are groups of protocols that do the same job.'

type CategoryTvl = { name: string; tvl: number | null }

/** Definition first. The dated ranking uses the three largest category totals on the page. */
export function categoryIntro(dateSec: number, categories: ReadonlyArray<CategoryTvl>): string {
	const date = formatDate(dateSec, { input: 'seconds' })
	const ranked: Array<{ name: string; tvl: number }> = []
	for (const category of categories) {
		if (category.tvl == null) continue
		ranked.push({ name: category.name, tvl: category.tvl })
	}
	ranked.sort((a, b) => b.tvl - a.tvl || a.name.localeCompare(b.name))
	const first = ranked[0]
	const second = ranked[1]
	const third = ranked[2]
	const firstTvl = first ? formatUsd(first.tvl, USD_LOWERCASE_MILLIONS_OPTIONS) : null
	const secondTvl = second ? formatUsd(second.tvl, USD_LOWERCASE_MILLIONS_OPTIONS) : null
	const thirdTvl = third ? formatUsd(third.tvl, USD_LOWERCASE_MILLIONS_OPTIONS) : null
	if (!date || !first || !second || !third || !firstTvl || !secondTvl || !thirdTvl) return CATEGORY_DEFINITION
	return `${CATEGORY_DEFINITION} On ${date} ${first.name} led with ${firstTvl}, then ${second.name} at ${secondTvl} and ${third.name} at ${thirdTvl}.`
}
