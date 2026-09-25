import type { BridgeNetflowChartPoint } from '~/containers/Bridges/types'
import { capitalizeFirstLetter } from '~/utils'

/** Splits each chain's net flow into an inflow bar (right of zero) and an outflow bar (left of zero). */
export function buildNetflowBars(data: Array<BridgeNetflowChartPoint>) {
	const positiveData: Array<number> = []
	const negativeData: Array<number> = []
	const chains: Array<string> = []
	const csvSource: Array<{ Chain: string; Inflow: number; Outflow: number; 'Net Flow': number }> = []
	for (const item of data) {
		const chain = capitalizeFirstLetter(item.chain)
		chains.push(chain)
		positiveData.push(item.value > 0 ? item.value : 0)
		negativeData.push(item.value < 0 ? item.value : 0)
		csvSource.push({
			Chain: chain,
			Inflow: item.value > 0 ? item.value : 0,
			Outflow: item.value < 0 ? Math.abs(item.value) : 0,
			'Net Flow': item.value
		})
	}
	return { positiveData, negativeData, chains, csvSource }
}
