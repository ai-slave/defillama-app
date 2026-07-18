import { Icon } from '~/ui/Icon'
import { CATEGORY_CARDS } from './CategoryCard'
import type { ChartTabType } from './types'

interface CategoryCardsGridProps {
	onSelectCategory: (category: ChartTabType) => void
}

export function CategoryCardsGrid({ onSelectCategory }: CategoryCardsGridProps) {
	const heroCard = CATEGORY_CARDS[0]
	const otherCards = CATEGORY_CARDS.slice(1)

	return (
		<div className="flex h-full flex-col p-4">
			<button
				onClick={() => onSelectCategory(heroCard.id)}
				className="group relative flex flex-col rounded-xl border pro-border p-5 text-left transition-all hover:border-brand/50"
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
				<div className="grid grid-cols-2 gap-2">
					{otherCards.map((card) => (
						<button
							key={card.id}
							onClick={() => onSelectCategory(card.id)}
							className="group flex items-start gap-2.5 rounded-lg border pro-border p-3 text-left transition-all hover:border-brand/50"
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
