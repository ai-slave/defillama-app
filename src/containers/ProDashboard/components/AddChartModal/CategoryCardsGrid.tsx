import { Icon, type IIcon } from '~/ui/Icon'
import type { ChartTabType } from './types'

type IconName = IIcon['name']

interface CategoryCardData {
	id: ChartTabType
	title: string
	description: string
	icon: IconName
	tags: Array<string>
}

const CATEGORY_CARDS: Array<CategoryCardData> = [
	{
		id: 'chain',
		title: 'Protocols & chains',
		description: 'TVL, Fees, Revenue, Volume, Users across 5000+ protocols and 450+ chains',
		icon: 'layers',
		tags: ['TVL', 'Fees', 'Revenue', 'Volume', 'Users']
	},
	{
		id: 'income-statement',
		title: 'Income Statement',
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
	const heroCard = CATEGORY_CARDS[0]
	const otherCards = CATEGORY_CARDS.slice(1)

	return (
		<div className="flex h-full flex-col">
			<button
				type="button"
				onClick={() => onSelectCategory(heroCard.id)}
				className="group relative flex flex-col rounded-lg border border-pro-cards-border p-5 text-left transition-all hover:border-pro-accent/40"
			>
				<div className="mb-3 flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div className="flex size-10 items-center justify-center rounded-lg bg-brand/10">
							<Icon name={heroCard.icon} height={22} width={22} className="text-brand" />
						</div>
						<h3 className="text-lg font-semibold text-pro-text-primary">{heroCard.title}</h3>
					</div>
					<Icon
						name="arrow-right"
						height={18}
						width={18}
						className="text-pro-text-secondary transition-transform group-hover:translate-x-1 group-hover:text-brand"
					/>
				</div>
				<p className="mb-4 line-clamp-1 text-sm text-pro-text-secondary">{heroCard.description}</p>
				<div className="flex flex-wrap gap-1.5">
					{heroCard.tags.map((tag) => (
						<span
							key={tag}
							className="rounded-full px-2.5 py-1 text-xs font-medium text-pro-text-secondary transition-colors group-hover:bg-brand/10 group-hover:text-brand"
						>
							{tag}
						</span>
					))}
				</div>
			</button>

			<div className="mt-4">
				<span className="mb-2.5 block text-xs font-medium tracking-wide text-pro-text-secondary uppercase">
					Other datasets
				</span>
				<div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
					{otherCards.map((card) => (
						<button
							type="button"
							key={card.id}
							onClick={() => onSelectCategory(card.id)}
							className="group flex items-start gap-2.5 rounded-lg border border-pro-cards-border p-3 text-left transition-all hover:border-pro-accent/40"
						>
							<div className="flex size-8 shrink-0 items-center justify-center rounded-md transition-colors group-hover:bg-brand/10">
								<Icon
									name={card.icon}
									height={16}
									width={16}
									className="text-pro-text-secondary group-hover:text-brand"
								/>
							</div>
							<div className="min-w-0 flex-1">
								<span className="text-sm font-medium text-pro-text-primary">{card.title}</span>
								<p className="mt-0.5 line-clamp-1 text-xs text-pro-text-secondary">{card.description}</p>
							</div>
						</button>
					))}
				</div>
			</div>
		</div>
	)
}
