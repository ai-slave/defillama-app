import {
	ALERT_EMPTY_STATE_CHIPS,
	ALERT_ESCAPE_HATCH_PREFILL
} from '~/containers/LlamaAI/components/alerts/alertsListHelpers'
import type { TriggerType } from '~/containers/LlamaAI/components/alerts/createAlertForm'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'

interface EmptyAlertsStateProps {
	onOpenCreate: (tab: TriggerType) => void
	onChipSelect: (text: string, variant: 'static' | 'freeform') => void
}

export function EmptyAlertsState({ onOpenCreate, onChipSelect }: EmptyAlertsStateProps) {
	return (
		<div className="flex flex-col gap-4 p-4">
			<div className="text-center">
				<h3 className="heading-xs text-primary">Get pinged when things move</h3>
				<p className="mt-1 body-sm text-secondary">
					Price triggers fire instantly, scheduled reports arrive on your clock.
				</p>
			</div>

			<div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
				<button
					type="button"
					onClick={() => onOpenCreate('price')}
					className="group flex flex-col items-start gap-2.5 rounded-xl border border-subtle bg-page p-4 text-left not-disabled:not-aria-disabled:hover:border-warning-muted not-disabled:not-aria-disabled:hover:bg-warning-faint"
				>
					<span className="flex size-9 items-center justify-center rounded-lg bg-warning-tint text-warning">
						<Icon name="trending-up" className="size-4" />
					</span>
					<span className="label-md text-primary">Watch a price</span>
					<span className="body-sm text-secondary">
						Instant ping when a token crosses your level — checked continuously
					</span>
					<span className="mt-auto flex items-center gap-1 label-sm text-link">
						Set a price alert
						<Icon name="arrow-right" className="size-3.5" aria-hidden="true" />
					</span>
				</button>

				<button
					type="button"
					onClick={() => onOpenCreate('schedule')}
					className="group flex flex-col items-start gap-2.5 rounded-xl border border-subtle bg-page p-4 text-left not-disabled:not-aria-disabled:hover:border-brand-muted not-disabled:not-aria-disabled:hover:bg-brand-faint"
				>
					<span className="flex size-9 items-center justify-center rounded-lg bg-brand-tint text-link">
						<Icon name="calendar" className="size-4" />
					</span>
					<span className="label-md text-primary">Any question, on a schedule</span>
					<span className="body-sm text-secondary">
						No trigger needed — the agent answers a question of yours every day or week
					</span>
					<span className="mt-auto flex items-center gap-1 label-sm text-link">
						Ask on a schedule
						<Icon name="arrow-right" className="size-3.5" aria-hidden="true" />
					</span>
				</button>
			</div>

			<div className="flex flex-col items-center gap-2.5 border-t border-subtle pt-4">
				<p className="flex items-center gap-1.5 body-sm text-secondary">
					<Icon name="chat" className="size-3.5" />
					Or just describe it in chat
				</p>
				<div className="flex flex-wrap items-center justify-center gap-2">
					{ALERT_EMPTY_STATE_CHIPS.map((chip) => (
						<button
							key={chip.text}
							type="button"
							onClick={() => onChipSelect(chip.text, chip.variant)}
							className="rounded-full border border-medium px-3 py-1.5 body-sm text-secondary not-disabled:not-aria-disabled:hover:border-brand-muted not-disabled:not-aria-disabled:hover:bg-brand-faint not-disabled:not-aria-disabled:hover:text-link"
						>
							{chip.text}
						</button>
					))}
				</div>
				<Button
					type="button"
					size="sm"
					variant="ghost"
					onClick={() => onChipSelect(ALERT_ESCAPE_HATCH_PREFILL, 'freeform')}
				>
					Continue in chat
					<Icon name="arrow-right" className="size-3.5" aria-hidden="true" />
				</Button>
			</div>
		</div>
	)
}
