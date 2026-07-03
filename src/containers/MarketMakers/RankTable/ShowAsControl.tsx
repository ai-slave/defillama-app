import * as Ariakit from '@ariakit/react'
import { DISPLAY_MODES, type DisplayMode } from '../constants'
import { CheckCircleIcon } from '../icons'

const LABELS: Record<DisplayMode, string> = {
	value: 'Show as Value',
	percentile: 'Show as Percentile',
	rank: 'Show as Rank'
}

const SHORT: Record<DisplayMode, string> = {
	value: 'Value',
	percentile: 'Percentile',
	rank: 'Rank'
}

export function ShowAsControl({ mode, setMode }: { mode: DisplayMode; setMode: (mode: DisplayMode) => void }) {
	return (
		<>
			<div className="hidden items-center gap-0.5 rounded-md border border-(--form-control-border) p-0.5 min-[713px]:flex">
				{DISPLAY_MODES.map((option) => (
					<button
						key={option}
						type="button"
						onClick={() => setMode(option)}
						className={`rounded px-2.5 py-1 text-xs font-medium ${
							option === mode
								? 'bg-(--link-active-bg) text-white'
								: 'text-(--text-secondary) hover:bg-(--link-hover-bg)'
						}`}
					>
						{LABELS[option]}
					</button>
				))}
			</div>
			<div className="min-[713px]:hidden">
				<Ariakit.SelectProvider value={mode} setValue={(value) => setMode(value as DisplayMode)}>
					<Ariakit.Select className="inline-flex items-center gap-1 rounded-md border border-(--form-control-border) bg-(--cards-bg) px-3 py-1.5 text-sm font-medium text-(--text-primary)">
						{SHORT[mode]}
						<Ariakit.SelectArrow />
					</Ariakit.Select>
					<Ariakit.SelectPopover
						gutter={4}
						className="z-50 flex min-w-[11rem] flex-col gap-0.5 rounded-md border border-(--cards-border) bg-(--cards-bg) p-1 shadow-lg"
					>
						{DISPLAY_MODES.map((option) => (
							<Ariakit.SelectItem
								key={option}
								value={option}
								className="flex cursor-pointer items-center justify-between gap-3 rounded px-3 py-1.5 text-sm whitespace-nowrap data-[active-item]:bg-(--link-hover-bg)"
							>
								<span>{LABELS[option]}</span>
								{option === mode ? <CheckCircleIcon /> : null}
							</Ariakit.SelectItem>
						))}
					</Ariakit.SelectPopover>
				</Ariakit.SelectProvider>
			</div>
		</>
	)
}
