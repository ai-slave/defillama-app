import { Icon } from '~/ui/Icon'
import type { ChartTabType } from './types'

const CATEGORY_TITLES: Record<ChartTabType, string> = {
	chain: 'Protocols & Chains',
	protocol: 'Protocols & Chains',
	yields: 'Yields',
	stablecoins: 'Stablecoins',
	'advanced-tvl': 'Advanced TVL',
	borrowed: 'Borrowed',
	'income-statement': 'Income Statement',
	unlocks: 'Unlocks',
	rwa: 'RWA'
}

interface CategoryFormHeaderProps {
	category: ChartTabType
	onBack?: (() => void) | undefined
}

export function CategoryFormHeader({ category, onBack }: CategoryFormHeaderProps) {
	return (
		<div className="mb-3 flex items-center gap-2 border-b border-pro-cards-border pb-3">
			{onBack ? (
				<button
					type="button"
					onClick={onBack}
					className="flex items-center justify-center rounded-sm p-1.5 transition-colors hover:bg-pro-hover-fill"
					title="Back to categories"
				>
					<Icon name="arrow-left" height={18} width={18} />
				</button>
			) : null}
			<span className="text-sm font-medium text-pro-text-primary">{CATEGORY_TITLES[category]}</span>
		</div>
	)
}
