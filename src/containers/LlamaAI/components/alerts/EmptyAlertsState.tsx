import { Icon } from '~/components/Icon'
import {
	ALERT_EMPTY_STATE_CHIPS,
	ALERT_ESCAPE_HATCH_PREFILL
} from '~/containers/LlamaAI/components/alerts/alertsListHelpers'
import type { TriggerType } from '~/containers/LlamaAI/components/alerts/createAlertForm'

interface EmptyAlertsStateProps {
	onOpenCreate: (tab: TriggerType) => void
	onChipSelect: (text: string, variant: 'static' | 'freeform') => void
}

export function EmptyAlertsState({ onOpenCreate, onChipSelect }: EmptyAlertsStateProps) {
	return (
		<div className="flex flex-col gap-5 px-5 py-6">
			<div className="text-center">
				<h3 className="m-0 text-sm font-semibold tracking-tight text-ai-primary">Get pinged when things move</h3>
				<p className="m-0 mt-1 text-xs text-ai-tertiary">
					Price triggers fire instantly, scheduled reports arrive on your clock.
				</p>
			</div>

			<div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
				<button
					type="button"
					onClick={() => onOpenCreate('price')}
					className="group hover:bg-ai-warning-bright/0.03 flex flex-col items-start gap-2.5 rounded-xl border border-ai-line-subtle bg-ai-wash-faint p-4 text-left transition-all hover:border-ai-warning-bright/30"
				>
					<span className="flex size-9 items-center justify-center rounded-lg bg-ai-warning-bright/10 text-ai-warning-bright">
						<Icon name="trending-up" className="size-4" />
					</span>
					<span className="text-sm font-medium text-primary">Watch a price</span>
					<span className="text-xs leading-relaxed text-ai-tertiary">
						Instant ping when a token crosses your level — checked continuously
					</span>
					<span className="mt-auto flex items-center gap-1 text-xs font-medium text-link">
						Set a price alert
						<Icon name="arrow-right" className="size-3 transition-transform group-hover:translate-x-0.5" />
					</span>
				</button>

				<button
					type="button"
					onClick={() => onOpenCreate('schedule')}
					className="group flex flex-col items-start gap-2.5 rounded-xl border border-ai-line-subtle bg-ai-wash-faint p-4 text-left transition-all hover:border-link/30 hover:bg-link/3"
				>
					<span className="flex size-9 items-center justify-center rounded-lg bg-link/10 text-link">
						<Icon name="calendar" className="size-4" />
					</span>
					<span className="text-sm font-medium text-primary">Any question, on a schedule</span>
					<span className="text-xs leading-relaxed text-ai-tertiary">
						No trigger needed — the agent answers a question of yours every day or week
					</span>
					<span className="mt-auto flex items-center gap-1 text-xs font-medium text-link">
						Ask on a schedule
						<Icon name="arrow-right" className="size-3 transition-transform group-hover:translate-x-0.5" />
					</span>
				</button>
			</div>

			<div className="flex flex-col items-center gap-2.5 border-t border-ai-line-subtle pt-4">
				<p className="m-0 flex items-center gap-1.5 text-xs text-ai-tertiary">
					<Icon name="chat" className="size-3.5" />
					Or just describe it in chat
				</p>
				<div className="flex flex-wrap items-center justify-center gap-2">
					{ALERT_EMPTY_STATE_CHIPS.map((chip) => (
						<button
							key={chip.text}
							type="button"
							onClick={() => onChipSelect(chip.text, chip.variant)}
							className="rounded-full border border-ai-line-medium px-3 py-1.5 text-xs text-ai-tertiary transition-colors hover:border-link/40 hover:bg-link/4 hover:text-link"
						>
							{chip.text}
						</button>
					))}
				</div>
				<button
					type="button"
					onClick={() => onChipSelect(ALERT_ESCAPE_HATCH_PREFILL, 'freeform')}
					className="mt-0.5 text-xs text-ai-muted transition-colors hover:text-link hover:underline"
				>
					Continue in chat →
				</button>
			</div>
		</div>
	)
}
