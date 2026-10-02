import type { MutationStatus } from '@tanstack/react-query'
import { Button } from '~/ui/Button'
import { DialogFooter } from '~/ui/Dialog'
import { Icon } from '~/ui/Icon'
import type { ComparisonType, WizardStep } from '../types'
import { getStepIndex, WIZARD_STEPS } from '../types'

const STEP_LABELS: Record<WizardStep, string> = {
	'select-type': 'Type',
	'select-items': 'Items',
	'select-metrics': 'Metrics',
	preview: 'Preview'
}

export function WizardSteps({ currentStep }: { currentStep: WizardStep }) {
	const currentIndex = getStepIndex(currentStep)
	return (
		<div className="flex items-center justify-center gap-2">
			{WIZARD_STEPS.map((step, index) => {
				const isActive = index === currentIndex
				const isCompleted = index < currentIndex
				return (
					<div key={step} className="flex items-center gap-2">
						<div
							className={`flex size-8 items-center justify-center rounded-full label-sm transition-colors ${
								isActive ? 'bg-brand text-on-brand' : isCompleted ? 'bg-brand/20 text-brand' : 'text-tertiary'
							}`}
						>
							{isCompleted ? <Icon name="check" height={14} width={14} /> : index + 1}
						</div>
						<span className={`hidden label-sm sm:inline ${isActive ? 'text-primary' : 'text-tertiary'}`}>
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

// Mirrors the wizard's canProceed rules, so a disabled Next says what the step still needs.
function blockedReason(step: WizardStep, comparisonType: ComparisonType | null) {
	switch (step) {
		case 'select-type':
			return 'Choose chains or protocols'
		case 'select-items':
			return comparisonType === 'chains' ? 'Pick at least 1 chain' : 'Pick at least 1 protocol'
		case 'select-metrics':
			return 'Pick at least 1 metric'
		case 'preview':
			return 'Enter a dashboard name'
	}
}

interface WizardNavigationProps {
	currentStep: WizardStep
	comparisonType: ComparisonType | null
	canProceed: boolean
	onNext: () => void
	onBack: () => void
	onGenerate: () => void
	creationStatus: MutationStatus
}

export function WizardNavigation({
	currentStep,
	comparisonType,
	canProceed,
	onNext,
	onBack,
	onGenerate,
	creationStatus
}: WizardNavigationProps) {
	const isLastStep = currentStep === 'preview'

	return (
		<DialogFooter
			leading={
				<>
					<Button type="button" size="md" onClick={onBack} disabled={creationStatus === 'pending'}>
						<Icon name="arrow-left" height={14} width={14} />
						Back
					</Button>
					{canProceed ? null : <p className="body-sm text-secondary">{blockedReason(currentStep, comparisonType)}</p>}
				</>
			}
		>
			{isLastStep ? (
				<Button
					type="button"
					variant="primary"
					size="md"
					onClick={onGenerate}
					disabled={!canProceed}
					pendingLabel={creationStatus === 'pending' ? 'Creating…' : null}
				>
					<Icon name="plus" height={14} width={14} />
					Create dashboard
				</Button>
			) : (
				<Button type="button" variant="primary" size="md" onClick={onNext} disabled={!canProceed}>
					Next
					<Icon name="arrow-right" height={14} width={14} />
				</Button>
			)}
		</DialogFooter>
	)
}
