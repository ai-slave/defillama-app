// The pool page's MEASURED props, built in one place so the page and the private route that
// serves subscribers cannot drift.

import { applyMeasuredBase, applyMeasuredIntrinsic, type MeasuredApy, resolveApy } from '../data/apy'
import type { ApyComponent, VerifiedBlock } from '../data/types'
import { buildExitReliability, type ExitReliabilityModel } from './exitReliability'
import { buildGrowthChart, type GrowthChartModel } from './growthChart'
import { buildLiquidityChart, type LiquidityChartModel } from './liquidityChart'
import { buildSupplyChart, type PoolChartModel } from './poolCharts'
import type { PoolDetail, PoolHistory } from './types'
import type { VerifiedWindowRow } from './VerifiedApyPanel'

export interface PoolVerifiedProps {
	verified: VerifiedBlock | null
	/** Supply composition with the measured legs swapped in, computed as the earn table does. */
	apy: MeasuredApy | null
	verifiedWindows: Array<VerifiedWindowRow>
	growthChart: GrowthChartModel | null
	liquidityChart: LiquidityChartModel | null
	// Null when the pool carries no denomination; the chart then offers its USD view only.
	liquidityDecimals: number | null
	exitReliability: ExitReliabilityModel | null
	// The main rate chart carries a measured APY line, so it is rebuilt here too. Its TVL label
	// depends on protocol meta this builder has no access to, so it defaults and the view relabels.
	supplyChart: PoolChartModel | null
}

export const EMPTY_POOL_VERIFIED_PROPS: PoolVerifiedProps = {
	verified: null,
	apy: null,
	verifiedWindows: [],
	growthChart: null,
	liquidityChart: null,
	liquidityDecimals: null,
	exitReliability: null,
	supplyChart: null
}

/** Decimals live on the verified block; the symbol only reads unambiguously for a single token. */
function verifiedDenomination(pool: PoolDetail): { decimals: number | null; symbol: string | null } {
	const tokens = pool.underlying_tokens ?? []
	return {
		decimals: pool.verified?.denomination?.decimals ?? null,
		symbol: tokens.length === 1 ? (tokens[0].symbol ?? null) : null
	}
}

function buildVerifiedWindows(pool: PoolDetail): Array<VerifiedWindowRow> {
	const verified = pool.verified
	if (!verified) return []
	return [
		{ label: '24h', verified: verified.apy.avg_1d },
		{ label: '7d', verified: verified.apy.avg_7d },
		{ label: '30d', verified: verified.apy.avg_30d }
	]
}

const SUPPLY_APY_COMPONENTS: Array<ApyComponent> = ['base', 'reward', 'intrinsic']

function buildMeasuredApy(pool: PoolDetail, sourceVerified: VerifiedBlock | null): MeasuredApy | null {
	if (!pool.verified) return null
	const reported = resolveApy(pool.apy, pool.intrinsic, 'current', SUPPLY_APY_COMPONENTS)
	const measured = applyMeasuredBase(
		reported,
		pool.apy.current,
		pool.verified,
		'current',
		pool.reward_tokens.length > 0
	)
	return applyMeasuredIntrinsic(measured, sourceVerified, 'current')
}

export function buildPoolVerifiedProps({
	pool,
	history,
	fullHistory,
	sourceVerified = null
}: {
	pool: PoolDetail
	history: PoolHistory | null
	/** Exit reliability always aggregates the FULL measured history. */
	fullHistory: PoolHistory | null
	/** The intrinsic source pool's block, so its measured base can stand in for the intrinsic leg. */
	sourceVerified?: VerifiedBlock | null
}): PoolVerifiedProps {
	return {
		verified: pool.verified ?? null,
		apy: buildMeasuredApy(pool, sourceVerified),
		verifiedWindows: buildVerifiedWindows(pool),
		growthChart: history?.length ? buildGrowthChart(history) : null,
		liquidityChart: history?.length ? buildLiquidityChart(history, verifiedDenomination(pool)) : null,
		liquidityDecimals: pool.verified?.denomination?.decimals ?? null,
		exitReliability: fullHistory?.length ? buildExitReliability(fullHistory) : null,
		// Redacted history carries no `verified` block, so the page never pays to rebuild a chart
		// identical to the one it already has.
		supplyChart: history?.some((point) => point.verified != null) ? buildSupplyChart(history) : null
	}
}
