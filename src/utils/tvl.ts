export interface TvlChartData {
	tvl?: Array<[string | number, number]>
	liquidstaking?: Array<[string | number, number]>
	doublecounted?: Array<[string | number, number]>
	dcAndLsOverlap?: Array<[string | number, number]>
}

export interface TvlOverlapValues {
	doublecounted?: number | null | undefined
	liquidstaking?: number | null | undefined
	dcAndLsOverlap?: number | null | undefined
}

export function applyTvlOverlapBaseAdjustment(
	baseValue: number | null | undefined,
	extraValues: TvlOverlapValues = {}
): number {
	return (
		(baseValue ?? 0) -
		(extraValues.doublecounted ?? 0) -
		(extraValues.liquidstaking ?? 0) +
		(extraValues.dcAndLsOverlap ?? 0)
	)
}

export const processAdjustedTvl = (data: TvlChartData | null | undefined): Array<[number, number]> => {
	const { tvl = [], liquidstaking = [], doublecounted = [], dcAndLsOverlap = [] } = data ?? {}

	const extraTvlCharts: Record<'liquidstaking' | 'doublecounted' | 'dcAndLsOverlap', Record<number, number>> = {
		liquidstaking: {},
		doublecounted: {},
		dcAndLsOverlap: {}
	}

	for (const [date, totalLiquidityUSD] of liquidstaking) {
		extraTvlCharts.liquidstaking[Number(date)] = Math.trunc(totalLiquidityUSD)
	}
	for (const [date, totalLiquidityUSD] of doublecounted) {
		extraTvlCharts.doublecounted[Number(date)] = Math.trunc(totalLiquidityUSD)
	}
	for (const [date, totalLiquidityUSD] of dcAndLsOverlap) {
		extraTvlCharts.dcAndLsOverlap[Number(date)] = Math.trunc(totalLiquidityUSD)
	}

	const adjustedTvl: Array<[number, number]> = tvl.map(([date, totalLiquidityUSD]) => {
		const timestamp = Number(date)
		const sum = applyTvlOverlapBaseAdjustment(Math.trunc(totalLiquidityUSD), {
			liquidstaking: extraTvlCharts.liquidstaking[timestamp],
			doublecounted: extraTvlCharts.doublecounted[timestamp],
			dcAndLsOverlap: extraTvlCharts.dcAndLsOverlap[timestamp]
		})
		return [timestamp, sum] as [number, number]
	})

	return adjustedTvl
}
