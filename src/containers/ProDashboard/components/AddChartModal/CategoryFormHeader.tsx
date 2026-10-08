import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import type { ChartTabType } from './types'

const CATEGORY_TITLES: Record<ChartTabType, string> = {
	chain: 'Protocols & chains',
	protocol: 'Protocols & chains',
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
		<div className="mb-3 flex items-center gap-2 border-b border-pro-cards-border pb-3 label-md">
			{onBack ? (
				<>
					<Button variant="link" onClick={onBack}>
						<Icon name="arrow-left" className="size-3.5" />
						Categories
					</Button>
					<span aria-hidden className="text-pro-text-tertiary">
						/
					</span>
				</>
			) : null}
			<span className="text-pro-text-primary">{CATEGORY_TITLES[category]}</span>
		</div>
	)
}
