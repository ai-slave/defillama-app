import { slug } from '~/utils'

// Costs that settle off-chain and are not public, so the income statement can't include them.
// Rows render as "Unknown"; never put private deal figures here.
export interface OffchainCostDisclosure {
	costOfRevenue: Record<string, string>
	earningsNote: string
	metricsWarning: string
}

const OFFCHAIN_COST_DISCLOSURES: Record<string, OffchainCostDisclosure> = {
	'etherfi-cash-liquid': {
		costOfRevenue: {
			'FX & cross-border costs':
				'Paid off-chain and vary by region and charge type, so the amount cannot be measured onchain.',
			'Card issuer & network costs':
				'Revenue is estimated at 1.38% of card spend. Card issuer and network (Visa) fees come out of this, plus fees ether.fi pays its card program provider, Rain. All set in private contracts and paid off-chain.'
		},
		earningsNote: 'Excludes off-chain costs under Cost of Revenue, so actual earnings may be lower.',
		metricsWarning: 'Not all costs are included. FX, card issuer and network costs are paid off-chain and unknown.'
	}
}

export const getOffchainCostDisclosure = (protocolName: string): OffchainCostDisclosure | null =>
	OFFCHAIN_COST_DISCLOSURES[slug(protocolName)] ?? null
