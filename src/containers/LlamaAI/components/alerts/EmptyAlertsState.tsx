import {
	ALERT_EMPTY_STATE_CHIPS,
	ALERT_ESCAPE_HATCH_PREFILL
} from '~/containers/LlamaAI/components/alerts/alertsListHelpers'
import type { TriggerType } from '~/containers/LlamaAI/components/alerts/createAlertForm'
import { Icon } from '~/ui/Icon'

interface EmptyAlertsStateProps {
	onOpenCreate: (tab: TriggerType) => void
	onChipSelect: (text: string, variant: 'static' | 'freeform') => void
}

export function EmptyAlertsState({ onOpenCreate, onChipSelect }: EmptyAlertsStateProps) {
	return (
		<div className="flex flex-col gap-5 px-5 py-6">
			<div className="text-center">
				<h3 className="m-0 text-sm font-semibold tracking-tight text-primary">Get pinged when things move</h3>
				<p className="m-0 mt-1 text-xs text-tertiary">
					Price triggers fire instantly, scheduled reports arrive on your clock.
				</p>
			</div>

			<div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
				<button
					type="button"
					onClick={() => onOpenCreate('price')}
					className="group flex flex-col items-start gap-2.5 rounded-xl border border-subtle bg-page p-4 text-left not-disabled:not-aria-disabled:hover:border-warning/30 not-disabled:not-aria-disabled:hover:bg-warning/3"
				>
					<span className="flex size-9 items-center justify-center rounded-lg bg-warning/10 text-warning">
						<Icon name="trending-up" className="size-4" />
					</span>
					<span className="text-sm font-medium text-primary">Watch a price</span>
					<span className="text-xs leading-relaxed text-tertiary">
						Instant ping when a token crosses your level — checked continuously
					</span>
					<span className="mt-auto flex items-center gap-1 text-xs font-medium text-link">
						Set a price alert
						<Icon name="arrow-right" className="size-3" />
					</span>
				</button>

				<button
					type="button"
					onClick={() => onOpenCreate('schedule')}
					className="group flex flex-col items-start gap-2.5 rounded-xl border border-subtle bg-page p-4 text-left not-disabled:not-aria-disabled:hover:border-link/30 not-disabled:not-aria-disabled:hover:bg-link/3"
				>
					<span className="flex size-9 items-center justify-center rounded-lg bg-link/10 text-link">
						<Icon name="calendar" className="size-4" />
					</span>
					<span className="text-sm font-medium text-primary">Any question, on a schedule</span>
					<span className="text-xs leading-relaxed text-tertiary">
						No trigger needed — the agent answers a question of yours every day or week
					</span>
					<span className="mt-auto flex items-center gap-1 text-xs font-medium text-link">
						Ask on a schedule
						<Icon name="arrow-right" className="size-3" />
					</span>
				</button>
			</div>

			<div className="flex flex-col items-center gap-2.5 border-t border-subtle pt-4">
				<p className="m-0 flex items-center gap-1.5 text-xs text-tertiary">
					<Icon name="chat" className="size-3.5" />
					Or just describe it in chat
				</p>
				<div className="flex flex-wrap items-center justify-center gap-2">
					{ALERT_EMPTY_STATE_CHIPS.map((chip) => (
						<button
							key={chip.text}
							type="button"
							onClick={() => onChipSelect(chip.text, chip.variant)}
							className="rounded-full border border-medium px-3 py-1.5 text-xs text-tertiary not-disabled:not-aria-disabled:hover:border-link/40 not-disabled:not-aria-disabled:hover:bg-link/4 not-disabled:not-aria-disabled:hover:text-link"
						>
							{chip.text}
						</button>
					))}
				</div>
				<button
					type="button"
					onClick={() => onChipSelect(ALERT_ESCAPE_HATCH_PREFILL, 'freeform')}
					className="mt-0.5 text-xs text-tertiary not-disabled:not-aria-disabled:hover:text-link not-disabled:not-aria-disabled:hover:underline"
				>
					Continue in chat →
				</button>
			</div>
		</div>
	)
}
