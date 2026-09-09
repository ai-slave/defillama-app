import type { MutationStatus } from '@tanstack/react-query'
import { Icon } from '~/ui/Icon'
import { LoadingSpinner } from '~/ui/Loaders'
import type { WizardStep } from '../types'
import { getStepIndex, WIZARD_STEPS } from '../types'

interface WizardNavigationProps {
	currentStep: WizardStep
	canProceed: boolean
	canGoBack: boolean
	onNext: () => void
	onBack: () => void
	onGenerate?: () => void
	creationStatus: MutationStatus
}

const STEP_LABELS: Record<WizardStep, string> = {
	'select-type': 'Type',
	'select-items': 'Items',
	'select-metrics': 'Metrics',
	preview: 'Preview'
}

export function WizardNavigation({
	currentStep,
	canProceed,
	canGoBack,
	onNext,
	onBack,
	onGenerate,
	creationStatus
}: WizardNavigationProps) {
	const currentIndex = getStepIndex(currentStep)
	const isLastStep = currentStep === 'preview'

	return (
		<div className="flex flex-col gap-4">
			<div className="flex items-center justify-center gap-2">
				{WIZARD_STEPS.map((step, index) => {
					const isActive = index === currentIndex
					const isCompleted = index < currentIndex
					return (
						<div key={step} className="flex items-center gap-2">
							<div
								className={`flex size-8 items-center justify-center rounded-full text-xs font-medium transition-colors ${
									isActive
										? 'bg-brand text-on-brand'
										: isCompleted
											? 'bg-brand/20 text-brand'
											: 'text-pro-text-tertiary'
								}`}
							>
								{isCompleted ? <Icon name="check" height={14} width={14} /> : index + 1}
							</div>
							<span
								className={`hidden text-xs sm:inline ${isActive ? 'font-medium text-pro-text-primary' : 'text-pro-text-tertiary'}`}
							>
								{STEP_LABELS[step]}
							</span>
							{index < WIZARD_STEPS.length - 1 ? (
								<div className={`h-px w-8 ${isCompleted ? 'bg-brand/40' : 'bg-pro-cards-border'}`} />
							) : null}
						</div>
					)
				})}
			</div>

			<div className="flex items-center justify-between gap-3 border-t border-pro-cards-border pt-4">
				<button
					type="button"
					onClick={onBack}
					disabled={!canGoBack}
					className="flex items-center gap-1.5 rounded-md border border-pro-form-control-border px-4 py-2 text-sm font-medium text-pro-text-secondary transition-colors hover:border-brand/40 hover:text-pro-text-primary disabled:cursor-not-allowed disabled:opacity-50"
				>
					<Icon name="arrow-left" height={14} width={14} />
					Back
				</button>

				{isLastStep ? (
					<button
						type="button"
						onClick={onGenerate}
						disabled={!canProceed || creationStatus === 'pending' || creationStatus === 'success'}
						className="flex items-center gap-1.5 rounded-md bg-brand px-6 py-2 text-sm font-medium text-on-brand transition-colors hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{creationStatus === 'pending' ? (
							<LoadingSpinner size={16} />
						) : (
							<Icon name={creationStatus === 'success' ? 'check' : 'plus'} height={14} width={14} />
						)}
						{creationStatus === 'pending' ? 'Creating…' : creationStatus === 'success' ? 'Created' : 'Create Dashboard'}
					</button>
				) : (
					<button
						type="button"
						onClick={onNext}
						disabled={!canProceed}
						className="flex items-center gap-1.5 rounded-md bg-brand px-6 py-2 text-sm font-medium text-on-brand transition-colors hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-50"
					>
						Next
						<Icon name="arrow-right" height={14} width={14} />
					</button>
				)}
			</div>
		</div>
	)
}
