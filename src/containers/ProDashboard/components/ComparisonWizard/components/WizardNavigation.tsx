import { Button } from '~/ui/Button'
import { DialogFooter } from '~/ui/Dialog'
import { Icon } from '~/ui/Icon'
import type { WizardStep } from '../types'
import { WIZARD_STEPS } from '../types'

const STEP_LABELS: Record<WizardStep, string> = {
	'select-type': 'Type',
	'select-items': 'Items',
	'select-metrics': 'Metrics',
	preview: 'Preview'
}

export function WizardSteps({ currentStep }: { currentStep: WizardStep }) {
	const currentIndex = WIZARD_STEPS.indexOf(currentStep)
	return (
		<div className="flex items-center justify-center gap-2">
			{WIZARD_STEPS.map((step, index) => {
				const isActive = index === currentIndex
				const isCompleted = index < currentIndex
				return (
					<div key={step} aria-current={isActive ? 'step' : undefined} className="flex items-center gap-2">
						<div
							className={`flex size-8 items-center justify-center rounded-full label-sm transition-colors ${
								isActive ? 'bg-brand text-on-brand' : isCompleted ? 'bg-brand/20 text-link' : 'text-tertiary'
							}`}
						>
							{isCompleted ? (
								<Icon name="check" height={14} width={14} role="img" aria-label={`Step ${index + 1} done`} />
							) : (
								index + 1
							)}
						</div>
						<span className={`label-sm sm:inline ${isActive ? 'text-primary' : 'hidden text-tertiary'}`}>
							{STEP_LABELS[step]}
						</span>
						{index < WIZARD_STEPS.length - 1 ? (
							<div className={`h-px w-8 ${isCompleted ? 'bg-brand/40' : 'bg-border-subtle'}`} />
						) : null}
					</div>
				)
			})}
		</div>
	)
}

interface WizardNavigationProps {
	currentStep: WizardStep
	/** What the step still needs, said beside a disabled Next or Create. */
	blockedReason: string | null
	onNext: () => void
	onBack: () => void
	onGenerate: () => void
	creating: boolean
}

export function WizardNavigation({
	currentStep,
	blockedReason,
	onNext,
	onBack,
	onGenerate,
	creating
}: WizardNavigationProps) {
	const isLastStep = currentStep === 'preview'

	return (
		<DialogFooter
			leading={
				<>
					<Button type="button" size="md" onClick={onBack} disabled={creating}>
						<Icon name="arrow-left" height={14} width={14} />
						Back
					</Button>
					{blockedReason ? <p className="body-sm text-secondary">{blockedReason}</p> : null}
				</>
			}
		>
			{isLastStep ? (
				<Button
					type="button"
					variant="primary"
					size="md"
					onClick={onGenerate}
					disabled={blockedReason !== null}
					accessibleWhenDisabled
					pendingLabel={creating ? 'Creating…' : null}
				>
					<Icon name="plus" height={14} width={14} />
					Create dashboard
				</Button>
			) : (
				// Kept focusable while disabled: a step that starts incomplete disables Next under the focus that moved there.
				<Button
					type="button"
					variant="primary"
					size="md"
					onClick={onNext}
					disabled={blockedReason !== null}
					accessibleWhenDisabled
				>
					Next
					<Icon name="arrow-right" height={14} width={14} />
				</Button>
			)}
		</DialogFooter>
	)
}
