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
				<Ariakit.SelectProvider value={mode} setValue={(value) => setMode(value as DisplayMode)}>
					<Ariakit.Select className={selectTriggerStyles('filter', 'md')}>
						{SHORT[mode]}
						<Ariakit.SelectArrow />
					</Ariakit.Select>
					<Ariakit.SelectPopover
						gutter={6}
						wrapperProps={{ className: popoverMobileWrapperClassName }}
						className={`${popoverSurfaceStyles} z-50 min-w-[11rem]`}
						portal
					>
						<Ariakit.PopoverDismiss className={popoverMobileDismissStyles}>
							<Icon name="x" className="size-5" />
						</Ariakit.PopoverDismiss>
						{DISPLAY_MODES.map((option) => (
							<Ariakit.SelectItem key={option} value={option} className={popoverRowWithBorderStyles}>
								<span>{LABELS[option]}</span>
								<span className={popoverSingleSelectCheckStyles(option === mode)} aria-hidden>
									{option === mode ? <Icon name="check" className="size-3" /> : null}
								</span>
							</Ariakit.SelectItem>
						))}
					</Ariakit.SelectPopover>
				</Ariakit.SelectProvider>
			</div>
		</>
	)
}
