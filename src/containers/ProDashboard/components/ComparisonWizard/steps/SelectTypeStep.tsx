import * as Ariakit from '@ariakit/react'
import { Icon } from '~/ui/Icon'
import { useComparisonWizardContext } from '../ComparisonWizardContext'
import type { ComparisonType } from '../types'

interface TypeOption {
	type: ComparisonType
	title: string
	description: string
	icon: 'chain' | 'protocol'
}

const TYPE_OPTIONS: Array<TypeOption> = [
	{
		type: 'chains',
		title: 'Compare chains',
		description: 'Compare metrics across multiple blockchain networks.',
		icon: 'chain'
	},
	{
		type: 'protocols',
		title: 'Compare protocols',
		description: 'Compare metrics across multiple DeFi protocols.',
		icon: 'protocol'
	}
]

export function SelectTypeStep() {
	const { state, actions } = useComparisonWizardContext()

	return (
		<div className="flex flex-col gap-6">
			<div className="text-center">
				<h3 className="label-md text-primary">What would you like to compare?</h3>
				<p className="mt-1 body-sm text-secondary">Choose whether to compare blockchain networks or DeFi protocols.</p>
			</div>

			<div className="grid gap-4 sm:grid-cols-2">
				{TYPE_OPTIONS.map((option, index) => {
					const isSelected = state.comparisonType === option.type
					return (
						// The control that opened this step leaves with the step before; the step starts on its choice.
						<Ariakit.Button
							key={option.type}
							autoFocus={state.comparisonType === null ? index === 0 : isSelected}
							type="button"
							aria-pressed={isSelected}
							onClick={() => actions.setComparisonType(option.type)}
							className={`flex flex-col items-center gap-4 rounded-lg border p-6 text-center transition-colors ${
								isSelected ? 'border-brand bg-brand-faint' : 'border-subtle bg-surface hover:border-brand/40'
							}`}
						>
							<div
								className={`flex size-16 items-center justify-center rounded-lg transition-colors ${
									isSelected ? 'bg-brand-muted text-link-on-tint' : 'text-secondary'
								}`}
							>
								<Icon name={option.icon} height={32} width={32} />
							</div>
							<div>
								<span className="block label-md text-primary">{option.title}</span>
								<span className="mt-1 block body-sm text-tertiary">{option.description}</span>
							</div>
							{isSelected ? (
								<div aria-hidden className="flex items-center gap-1.5 label-sm text-link">
									<Icon name="check" height={14} width={14} />
									Selected
								</div>
							) : null}
						</Ariakit.Button>
					)
				})}
			</div>
		</div>
	)
}
