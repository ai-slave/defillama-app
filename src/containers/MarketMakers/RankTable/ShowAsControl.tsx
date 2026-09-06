import * as Ariakit from '@ariakit/react'
import { selectTriggerStyles } from '~/components/Select/types'
import { Icon } from '~/ui/Icon'
import {
	popoverSingleSelectCheckStyles,
	popoverRowWithBorderStyles,
	popoverSurfaceStyles,
	popoverMobileDismissStyles,
	popoverMobileWrapperClassName
} from '~/ui/Popover'
import { chartSegmentedControlButtonStyles, chartSegmentedControlGroupStyles } from '~/ui/SegmentedControl'
import { DISPLAY_MODES, type DisplayMode } from '../constants'

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
			<div className={`${chartSegmentedControlGroupStyles} hidden min-[713px]:flex`}>
				{DISPLAY_MODES.map((option) => (
					<button
						key={option}
						type="button"
						onClick={() => setMode(option)}
						className={chartSegmentedControlButtonStyles}
						data-active={option === mode}
					>
						{LABELS[option]}
					</button>
				))}
			</div>
			<div className="min-[713px]:hidden">
				<Ariakit.ComboboxProvider selectedValue={mode} setSelectedValue={(value) => setMode(value as DisplayMode)}>
					<Ariakit.ComboboxSelect className={selectTriggerStyles('filter', 'md')}>
						{SHORT[mode]}
						<Ariakit.ComboboxSelectArrow />
					</Ariakit.ComboboxSelect>
					<Ariakit.ComboboxPopover
						gutter={6}
						wrapperProps={{ className: popoverMobileWrapperClassName }}
						className={`${popoverSurfaceStyles} z-50 min-w-[11rem]`}
						portal
					>
						<Ariakit.PopoverDismiss className={popoverMobileDismissStyles}>
							<Icon name="x" className="size-5" />
						</Ariakit.PopoverDismiss>
						{DISPLAY_MODES.map((option) => (
							<Ariakit.ComboboxItem key={option} value={option} className={popoverRowWithBorderStyles}>
								<span>{LABELS[option]}</span>
								<Ariakit.ComboboxItemSelected>
									{(selected) => (
										<span className={popoverSingleSelectCheckStyles(selected)} aria-hidden>
											{selected ? <Icon name="check" className="size-3" /> : null}
										</span>
									)}
								</Ariakit.ComboboxItemSelected>
							</Ariakit.ComboboxItem>
						))}
					</Ariakit.ComboboxPopover>
				</Ariakit.ComboboxProvider>
			</div>
		</>
	)
}
