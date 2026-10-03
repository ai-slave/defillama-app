import * as Ariakit from '@ariakit/react'
import { selectTriggerStyles } from '~/components/Select/types'
import { Icon } from '~/ui/Icon'
import { popoverRowWithBorderStyles, popoverSingleSelectCheckStyles } from '~/ui/Popover'
import { ComboboxSurface } from '~/ui/PopoverSurface'
import { THRESHOLDS, type Threshold } from '../constants'

export function ThresholdSelect({ value, setValue }: { value: Threshold; setValue: (value: Threshold) => void }) {
	return (
		<Ariakit.ComboboxProvider selectedValue={value} setSelectedValue={(v) => setValue(v as Threshold)}>
			<Ariakit.ComboboxSelect className={selectTriggerStyles('filter', 'md')}>
				<span>{value}</span>
				<span className="hidden min-[713px]:inline">Threshold</span>
				<Ariakit.ComboboxSelectArrow />
			</Ariakit.ComboboxSelect>
			<ComboboxSurface variant="list" heading="Threshold" className="min-w-[10rem]">
				{THRESHOLDS.map((threshold) => (
					<Ariakit.ComboboxItem key={threshold} value={threshold} className={popoverRowWithBorderStyles}>
						<span>{threshold} Threshold</span>
						<Ariakit.ComboboxItemSelected>
							{(selected) => (
								<span className={popoverSingleSelectCheckStyles(selected)}>
									<Icon name="check" className="size-3" />
								</span>
							)}
						</Ariakit.ComboboxItemSelected>
					</Ariakit.ComboboxItem>
				))}
			</ComboboxSurface>
		</Ariakit.ComboboxProvider>
	)
}
