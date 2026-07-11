import { Icon } from '~/components/Icon'
import { useComparisonWizardContext } from '../ComparisonWizardContext'
import type { ComparisonType } from '../types'

interface TypeOption {
	type: ComparisonType
	title: string
	description: string
	icon: 'chain' | 'protocol'
}

const TYPE_OPTIONS: TypeOption[] = [
	{
		type: 'chains',
		title: 'Compare Chains',
		description: 'Compare metrics across multiple blockchain networks',
		icon: 'chain'
	},
	{
		type: 'protocols',
		title: 'Compare Protocols',
		description: 'Compare metrics across multiple DeFi protocols',
		icon: 'protocol'
	}
]

export function SelectTypeStep() {
	const { state, actions } = useComparisonWizardContext()

	return (
		<div className="flex flex-col gap-6">
			<div className="text-center">
				<h2 className="text-lg font-semibold text-(--legacy-text-primary)">What would you like to compare?</h2>
				<p className="mt-1 text-sm text-(--legacy-text-secondary)">
					Choose whether to compare blockchain networks or DeFi protocols
				</p>
			</div>

			<div className="grid gap-4 sm:grid-cols-2">
				{TYPE_OPTIONS.map((option) => {
					const isSelected = state.comparisonType === option.type
					return (
						<button
							key={option.type}
							type="button"
							onClick={() => actions.setComparisonType(option.type)}
							className={`flex flex-col items-center gap-4 rounded-xl border-2 p-6 text-center transition-all ${
								isSelected
									? 'border-(--legacy-primary) bg-(--legacy-primary)/5 ring-2 ring-(--legacy-primary)/20'
									: 'border-(--legacy-cards-border) bg-(--legacy-cards-bg) hover:border-(--legacy-primary)/40 hover:bg-(--cards-bg-alt)/50'
							}`}
						>
							<div
								className={`flex size-16 items-center justify-center rounded-2xl transition-colors ${
									isSelected
										? 'bg-(--legacy-primary)/15 text-(--legacy-primary)'
										: 'bg-(--cards-bg-alt) text-(--legacy-text-secondary)'
								}`}
							>
								<Icon name={option.icon} height={32} width={32} />
							</div>
							<div>
								<h3 className="text-base font-semibold text-(--legacy-text-primary)">{option.title}</h3>
								<p className="mt-1 text-sm text-(--legacy-text-tertiary)">{option.description}</p>
							</div>
							{isSelected ? (
								<div className="flex items-center gap-1.5 text-sm font-medium text-(--legacy-primary)">
									<Icon name="check" height={14} width={14} />
									Selected
								</div>
							) : null}
						</button>
					)
				})}
			</div>
		</div>
	)
}
