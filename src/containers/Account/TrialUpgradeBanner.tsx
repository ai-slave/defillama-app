import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
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
		<Card padding="md" tone="brand" className="flex items-center">
			<div className="flex w-full flex-col gap-4 sm:w-[200px]">
				<div className="flex flex-col gap-3">
					<p className="sub-gradient-text heading-xs">Unlock the full power of DefiLlama</p>
					<ul className="flex flex-col gap-1.5">
						{BENEFITS.map((b) => (
							<li key={b} className="flex items-start gap-1.5 body-sm">
								<span className="flex h-lh shrink-0 items-center">
									<Icon name="check" className="size-3.5 text-link" />
								</span>
								<span className="text-primary">{b}</span>
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
				{isApplying ? <p className="body-sm text-tertiary">{END_TRIAL_APPLYING_REASON}</p> : null}
			</div>
		</Card>
	)
}
