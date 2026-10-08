import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { END_TRIAL_APPLYING_REASON, useEndTrialApplying } from './endTrialHold'

interface TrialUpgradeBannerProps {
	onUpgrade: () => void
}

const BENEFITS = [
	'Full CSV download access',
	'5 deep research questions per day',
	'$10/month in LlamaAI data credits',
	'All Pro features without limitations'
]

export function TrialUpgradeBanner({ onUpgrade }: TrialUpgradeBannerProps) {
	const isApplying = useEndTrialApplying()
	return (
		<div className="flex items-center rounded-2xl border border-sub-brand-primary bg-sub-brand-primary/20 p-4">
			<div className="flex w-full flex-col gap-4 sm:w-[200px]">
				<div className="flex flex-col gap-3">
					<p className="bg-linear-to-r from-sub-brand-primary to-sub-brand-soft bg-clip-text text-lg leading-[22px] font-semibold text-transparent dark:from-sub-brand-secondary dark:to-sub-brand-softest dark:to-[64%]">
						Unlock the full power of DefiLlama
					</p>
					<ul className="flex flex-col gap-1.5">
						{BENEFITS.map((b) => (
							<li key={b} className="flex items-start gap-1.5">
								<Icon name="check" height={14} width={14} className="mt-0.5 shrink-0 text-sub-brand-primary" />
								<span className="text-xs leading-4 text-sub-text-primary">{b}</span>
							</li>
						))}
					</ul>
				</div>
				{/* The hold starts in the dialog this button opened, and that dialog returns focus here on close. */}
				<Button
					variant="primary"
					size="md"
					onClick={onUpgrade}
					disabled={isApplying}
					accessibleWhenDisabled
					className="w-full"
				>
					Upgrade to Pro
				</Button>
				{isApplying ? <p className="text-xs leading-4 text-sub-text-muted">{END_TRIAL_APPLYING_REASON}</p> : null}
			</div>
		</div>
	)
}
