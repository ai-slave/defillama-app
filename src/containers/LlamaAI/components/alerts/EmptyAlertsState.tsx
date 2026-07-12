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
				<h3 className="m-0 text-sm font-semibold tracking-tight text-black dark:text-white">
					Get pinged when things move
				</h3>
				<p className="m-0 mt-1 text-xs text-[#777] dark:text-[#919296]">
					Price triggers fire instantly, scheduled reports arrive on your clock.
				</p>
			</div>

			<div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
				<button
					type="button"
					onClick={() => onOpenCreate('price')}
					className="group flex flex-col items-start gap-2.5 rounded-xl border border-black/[0.06] bg-black/[0.015] p-4 text-left transition-all hover:border-amber-500/30 hover:bg-amber-500/[0.03] dark:border-white/[0.06] dark:bg-white/[0.015] dark:hover:border-amber-400/30"
				>
					<span className="flex size-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
						<Icon name="trending-up" className="size-4" />
					</span>
					<span className="text-sm font-medium text-(--text-primary)">Watch a price</span>
					<span className="text-xs leading-relaxed text-[#777] dark:text-[#919296]">
						Instant ping when a token crosses your level — checked continuously
					</span>
					<span className="mt-auto flex items-center gap-1 text-xs font-medium text-(--link-text)">
						Set a price alert
						<Icon name="arrow-right" className="size-3 transition-transform group-hover:translate-x-0.5" />
					</span>
				</button>

				<button
					type="button"
					onClick={() => onOpenCreate('schedule')}
					className="group flex flex-col items-start gap-2.5 rounded-xl border border-black/[0.06] bg-black/[0.015] p-4 text-left transition-all hover:border-(--link-text)/30 hover:bg-(--link-text)/[0.03] dark:border-white/[0.06] dark:bg-white/[0.015]"
				>
					<span className="flex size-9 items-center justify-center rounded-lg bg-(--link-text)/10 text-(--link-text)">
						<Icon name="calendar" className="size-4" />
					</span>
					<span className="text-sm font-medium text-(--text-primary)">Any question, on a schedule</span>
					<span className="text-xs leading-relaxed text-[#777] dark:text-[#919296]">
						No trigger needed — the agent answers a question of yours every day or week
					</span>
					<span className="mt-auto flex items-center gap-1 text-xs font-medium text-(--link-text)">
						Ask on a schedule
						<Icon name="arrow-right" className="size-3 transition-transform group-hover:translate-x-0.5" />
					</span>
				</button>
			</div>

			<div className="flex flex-col items-center gap-2.5 border-t border-black/[0.06] pt-4 dark:border-white/[0.05]">
				<p className="m-0 flex items-center gap-1.5 text-xs text-[#777] dark:text-[#919296]">
					<Icon name="chat" className="size-3.5" />
					Or just describe it in chat
				</p>
				<div className="flex flex-wrap items-center justify-center gap-2">
					{ALERT_EMPTY_STATE_CHIPS.map((chip) => (
						<button
							key={chip.text}
							type="button"
							onClick={() => onChipSelect(chip.text, chip.variant)}
							className="rounded-full border border-black/[0.08] px-3 py-1.5 text-xs text-[#666] transition-colors hover:border-(--link-text)/40 hover:bg-(--link-text)/[0.04] hover:text-(--link-text) dark:border-white/[0.08] dark:text-[#919296]"
						>
							{chip.text}
						</button>
					))}
				</div>
				<button
					type="button"
					onClick={() => onChipSelect(ALERT_ESCAPE_HATCH_PREFILL, 'freeform')}
					className="mt-0.5 text-xs text-[#999] transition-colors hover:text-(--link-text) hover:underline dark:text-[#777]"
				>
					Continue in chat →
				</button>
			</div>
		</div>
	)
}
