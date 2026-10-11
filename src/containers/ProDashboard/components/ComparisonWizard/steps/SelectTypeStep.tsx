import * as Ariakit from '@ariakit/react'
import { useId } from 'react'
import { Icon } from '~/ui/Icon'
import { OptionTile } from '~/ui/OptionTile'
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
	const { state, actions, derived } = useComparisonWizardContext()
	const id = useId()
	const error = derived.shownStepError

	return (
		<div className="flex flex-col gap-6">
			<div className="text-center">
				<h3 id={`${id}-heading`} className="label-md text-primary">
					What would you like to compare?
				</h3>
				<p className="mt-1 body-sm text-secondary">Choose whether to compare blockchain networks or DeFi protocols.</p>
			</div>

			{/* The step's heading labels the choice, so its error is wired here instead of through FieldGroup's label. */}
			<div
				role="group"
				aria-labelledby={`${id}-heading`}
				aria-describedby={error ? `${id}-error` : undefined}
				data-invalid={error ? '' : undefined}
				className="flex flex-col gap-1"
			>
				<div className="grid gap-4 sm:grid-cols-2">
					{TYPE_OPTIONS.map((option, index) => {
						const isSelected = state.comparisonType === option.type
						return (
							// The control that opened this step leaves with the step before; the step starts on its choice.
							<Ariakit.Button
								key={option.type}
								autoFocus={state.comparisonType === null ? index === 0 : isSelected}
								aria-pressed={isSelected}
								onClick={() => actions.setComparisonType(option.type)}
								render={<OptionTile layout="center" selected={isSelected} />}
							>
								<Icon name={option.icon} className={isSelected ? 'size-8 text-link' : 'size-8 text-secondary'} />
								<div>
									<span className="block label-md text-primary">{option.title}</span>
									<span className="mt-1 block body-sm text-tertiary">{option.description}</span>
								</div>
								{isSelected ? (
									<div aria-hidden className="flex items-center gap-1.5 label-sm text-link">
										<Icon name="check" className="size-3.5" />
										Selected
									</div>
								) : null}
							</Ariakit.Button>
						)
					})}
				</div>
				{error ? (
					<p id={`${id}-error`} className="body-sm text-error">
						{error}
					</p>
				) : null}
			</div>
		</div>
	)
}
