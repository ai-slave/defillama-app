import { formatDate } from '~/utils/dateFormat'
import {
	formatPercent,
	formatUsd,
	PERCENT_POINTS_TWO_DECIMALS_OPTIONS,
	USD_LOWERCASE_MILLIONS_OPTIONS
} from '~/utils/numberFormat'

export const STABLECOIN_DEFINITION =
	'Stablecoins are crypto tokens that target a peg, usually one US dollar. This list ranks them by market cap, with circulating supply and how far each coin sits from its peg.'

export const STABLECOIN_QUESTION = 'What are stablecoins?'
export const USDT_DOMINANCE_QUESTION = 'What is USDT dominance?'

/** The visible FAQ. The dominance question is omitted when the share sentence is missing. */
export function stablecoinHubQuestions(intro: string | null): Array<{ question: string; answer: string }> {
	const questions = [{ question: STABLECOIN_QUESTION, answer: STABLECOIN_DEFINITION }]
	if (intro) questions.push({ question: USDT_DOMINANCE_QUESTION, answer: intro })
	return questions
}

type StablecoinMcap = { symbol: string; mcap: number | null }

function largestMcap(assets: ReadonlyArray<StablecoinMcap>, symbol: string): number | null {
	let best: number | null = null
	for (const asset of assets) {
		if (asset.symbol.toUpperCase() !== symbol || asset.mcap == null) continue
		if (best == null || asset.mcap > best) best = asset.mcap
	}
	return best
}

/**
 * USDT's share of stablecoin market cap, not TradingView's USDT.D. Null when the three coins or the
 * total are missing, so the page does not invent the share.
 */
export function stablecoinDominanceIntro(input: {
	dateSec: number | null
	totalMcap: number | null
	assets: ReadonlyArray<StablecoinMcap>
}): string | null {
	if (input.dateSec == null || input.totalMcap == null || input.totalMcap <= 0) return null
	const date = formatDate(input.dateSec, { input: 'seconds' })
	const usdt = largestMcap(input.assets, 'USDT')
	const usdc = largestMcap(input.assets, 'USDC')
	const dai = largestMcap(input.assets, 'DAI')
	if (!date || usdt == null || usdc == null || dai == null) return null
	const share = formatPercent((usdt / input.totalMcap) * 100, PERCENT_POINTS_TWO_DECIMALS_OPTIONS)
	const usdtUsd = formatUsd(usdt, USD_LOWERCASE_MILLIONS_OPTIONS)
	const total = formatUsd(input.totalMcap, USD_LOWERCASE_MILLIONS_OPTIONS)
	const usdcUsd = formatUsd(usdc, USD_LOWERCASE_MILLIONS_OPTIONS)
	const daiUsd = formatUsd(dai, USD_LOWERCASE_MILLIONS_OPTIONS)
	if (!share || !usdtUsd || !total || !usdcUsd || !daiUsd) return null
	return `USDT is ${share} of the stablecoin market on ${date}: ${usdtUsd} of a ${total} total, ahead of USDC at ${usdcUsd} and DAI at ${daiUsd}. This is each coin's share of stablecoin market cap. It is not TradingView's USDT.D index, which measures USDT against the whole crypto market.`
}
