import {
	ALERT_EMPTY_STATE_CHIPS,
	ALERT_ESCAPE_HATCH_PREFILL
} from '~/containers/LlamaAI/components/alerts/alertsListHelpers'
import type { TriggerType } from '~/containers/LlamaAI/components/alerts/createAlertForm'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
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
				<Card
					as="button"
					type="button"
					padding="md"
					onClick={() => onOpenCreate('price')}
					className="hover-wash-card flex cursor-pointer flex-col items-start gap-2.5 text-left"
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
				</Card>

				<Card
					as="button"
					type="button"
					padding="md"
					onClick={() => onOpenCreate('schedule')}
					className="hover-wash-card flex cursor-pointer flex-col items-start gap-2.5 text-left"
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
				</Card>
			</div>

			<div className="flex flex-col items-center gap-2.5 border-t border-subtle pt-4">
				<p className="flex items-center gap-1.5 body-sm text-secondary">
					<Icon name="message-square" className="size-3.5" />
					Or just describe it in chat
				</p>
				<div className="flex flex-wrap items-center justify-center gap-2">
					{ALERT_EMPTY_STATE_CHIPS.map((chip) => (
						<Button key={chip.text} variant="secondary" size="sm" onClick={() => onChipSelect(chip.text, chip.variant)}>
							{/* A suggestion runs long on a phone, so it wraps inside the pill instead of overflowing the dialog. */}
							<span className="whitespace-normal">{chip.text}</span>
						</Button>
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
