import { DatasetLauncher, type DatasetLauncherCard } from './DatasetLauncher'
import type { ChartTabType } from './types'

const CATEGORY_CARDS: Array<DatasetLauncherCard<ChartTabType>> = [
	{
		id: 'chain',
		title: 'Protocols & chains',
		description: 'TVL, Fees, Revenue, Volume, Users across 5000+ protocols and 450+ chains',
		icon: 'layers',
		tags: ['TVL', 'Fees', 'Revenue', 'Volume', 'Users']
	},
	{
		id: 'income-statement',
		title: 'Income statement',
		description: 'Financial flows with table and Sankey views for protocols with fees and revenue',
		icon: 'file-text',
		tags: ['Table', 'Sankey', 'Fees', 'Revenue']
	},
	{
		id: 'unlocks',
		title: 'Unlocks',
		description: 'Token unlock schedules and total unlocks by protocol',
		icon: 'linear-unlock',
		tags: ['Schedule', 'Total Unlocks', 'Emissions']
	},
	{
		id: 'yields',
		title: 'Yields & lending',
		description: 'Supply APY, borrow cost, TVL, and available liquidity from Yields V2',
		icon: 'trending-up',
		tags: ['Supply APY', 'Borrow Cost', 'TVL', 'Available']
	},
	{
		id: 'advanced-tvl',
		title: 'Advanced TVL',
		description: 'Token-level breakdown, inflows, detailed protocol analysis across 5000+ protocols',
		icon: 'bar-chart-2',
		tags: ['Tokens', 'Inflows', 'Breakdown']
	},
	{
		id: 'borrowed',
		title: 'Borrowed',
		description: 'Borrowed breakdowns by chain and token for lending protocols',
		icon: 'banknote',
		tags: ['Borrowed', 'Chains', 'Tokens']
	},
	{
		id: 'stablecoins',
		title: 'Stablecoins',
		description: 'Market cap, dominance, inflows by chain or asset',
		icon: 'dollar-sign',
		tags: ['Market Cap', 'Dominance', 'Inflows']
	},
	{
		id: 'rwa',
		title: 'RWA',
		description: 'Real World Assets by chain, category, or individual asset',
		icon: 'landmark',
		tags: ['Active AUM', 'Onchain AUM', 'DeFi TVL']
	}
]

interface CategoryCardsGridProps {
	onSelectCategory: (category: ChartTabType) => void
}

export function CategoryCardsGrid({ onSelectCategory }: CategoryCardsGridProps) {
	return <DatasetLauncher cards={CATEGORY_CARDS} isLocked={() => false} onSelect={onSelectCategory} />
}
