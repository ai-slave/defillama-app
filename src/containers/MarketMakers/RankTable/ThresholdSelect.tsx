import * as Ariakit from '@ariakit/react'
import { Icon } from '~/components/Icon'
import { selectTriggerStyles } from '~/components/Select/types'
import { popoverRowWithBorderStyles, popoverSingleSelectCheckStyles, popoverSurfaceStyles } from '~/ui/Popover'
import { THRESHOLDS, type Threshold } from '../constants'

export function ThresholdSelect({ value, setValue }: { value: Threshold; setValue: (value: Threshold) => void }) {
	return (
		<Ariakit.SelectProvider value={value} setValue={(v) => setValue(v as Threshold)}>
			<Ariakit.Select className={selectTriggerStyles('filter', 'md')}>
				<span>{value}</span>
				<span className="hidden min-[713px]:inline">Threshold</span>
				<Ariakit.SelectArrow />
			</Ariakit.Select>
			<Ariakit.SelectPopover gutter={4} className={`${popoverSurfaceStyles} z-50 min-w-[10rem]`}>
				{THRESHOLDS.map((threshold) => (
					<Ariakit.SelectItem key={threshold} value={threshold} className={popoverRowWithBorderStyles}>
						<span>{threshold} Threshold</span>
						<span className={popoverSingleSelectCheckStyles(threshold === value)}>
							<Icon name="check" className="size-3" />
						</span>
					</Ariakit.SelectItem>
				))}
			</Ariakit.SelectPopover>
		</Ariakit.SelectProvider>
	)
}
