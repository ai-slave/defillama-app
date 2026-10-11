import * as Ariakit from '@ariakit/react'
import { ComboboxSelectTrigger, selectTriggerStyles } from '~/ui/ComboboxSelectTrigger'
import { ComboboxSurface, PopoverList, PopoverRow } from '~/ui/PopoverSurface'
import { THRESHOLDS, type Threshold } from '../constants'

export function ThresholdSelect({ value, setValue }: { value: Threshold; setValue: (value: Threshold) => void }) {
	return (
		<Ariakit.ComboboxProvider selectedValue={value} setSelectedValue={(v) => setValue(v as Threshold)}>
			<ComboboxSelectTrigger className={selectTriggerStyles('filter', 'md')}>
				<span>{value}</span>
				<span className="hidden min-[713px]:inline">Threshold</span>
				<Ariakit.ComboboxSelectArrow />
			</ComboboxSelectTrigger>
			<ComboboxSurface variant="panel" heading="Threshold">
				<PopoverList divided>
					{THRESHOLDS.map((threshold) => (
						<PopoverRow
							key={threshold}
							render={<Ariakit.ComboboxItem value={threshold} />}
							check="tick"
							checked={threshold === value}
						>
							{threshold} Threshold
						</PopoverRow>
					))}
				</PopoverList>
			</ComboboxSurface>
		</Ariakit.ComboboxProvider>
	)
}
