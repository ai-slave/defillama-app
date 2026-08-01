import { slug } from '~/utils'
import type { IProtocolOverviewPageData } from './types'

type PrimaryMetricOverride = 'perpVolume30d'

const PRIMARY_METRIC_OVERRIDES: Record<string, PrimaryMetricOverride> = {
	stablejack: 'perpVolume30d'
}

export interface ProtocolPrimaryMetric {
	source: 'perpVolume'
	title: string
	byChainTitle: string
	value: number
	valueByChain: Array<[string, number]>
}

export function getProtocolPrimaryMetricOverride(
	protocol: Pick<IProtocolOverviewPageData, 'name'> & Partial<Pick<IProtocolOverviewPageData, 'perpVolume'>>
): ProtocolPrimaryMetric | null {
	const override = PRIMARY_METRIC_OVERRIDES[slug(protocol.name)]
	if (!override) return null

	switch (override) {
		case 'perpVolume30d': {
			if (protocol.perpVolume?.total30d == null) return null

			const valueByChain: Array<[string, number]> = []
			for (const chain in protocol.perpVolume.chainBreakdown) {
				const chainBreakdown = protocol.perpVolume.chainBreakdown[chain]
				if (chainBreakdown === undefined) continue
				const value = chainBreakdown.total30d
				if (value != null) valueByChain.push([chain, value])
			}
			valueByChain.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))

			return {
				source: 'perpVolume',
				title: 'Perp Volume 30d',
				byChainTitle: '30d volume by chain',
				value: protocol.perpVolume.total30d,
				valueByChain
			}
		}
	}
}
