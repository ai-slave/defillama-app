import * as Ariakit from '@ariakit/react'
import { THRESHOLDS, type Threshold } from '../constants'
import { CheckCircleIcon } from '../icons'

export function ThresholdSelect({ value, setValue }: { value: Threshold; setValue: (value: Threshold) => void }) {
	return (
		<Ariakit.SelectProvider value={value} setValue={(v) => setValue(v as Threshold)}>
			<Ariakit.Select className="inline-flex items-center gap-1 rounded-md border border-(--form-control-border) bg-(--cards-bg) px-3 py-1.5 text-sm font-medium text-(--text-primary)">
				<span>{value}</span>
				<span className="hidden min-[713px]:inline">Threshold</span>
				<Ariakit.SelectArrow />
			</Ariakit.Select>
			<Ariakit.SelectPopover
				gutter={4}
				className="z-50 flex min-w-[10rem] flex-col gap-0.5 rounded-md border border-(--cards-border) bg-(--cards-bg) p-1 shadow-lg"
			>
				{THRESHOLDS.map((threshold) => (
					<Ariakit.SelectItem
						key={threshold}
						value={threshold}
						className="flex cursor-pointer items-center justify-between gap-3 rounded px-3 py-1.5 text-sm whitespace-nowrap data-[active-item]:bg-(--link-hover-bg)"
					>
						<span>{threshold} Threshold</span>
						{threshold === value ? <CheckCircleIcon /> : null}
					</Ariakit.SelectItem>
				))}
			</Ariakit.SelectPopover>
		</Ariakit.SelectProvider>
	)
}
