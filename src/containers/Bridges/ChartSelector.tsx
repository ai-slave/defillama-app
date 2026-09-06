import * as Ariakit from '@ariakit/react'
import * as React from 'react'
import { selectTriggerStyles } from '~/components/Select/types'
import { Icon } from '~/ui/Icon'
import {
	popoverRowWithBorderStyles,
	popoverSurfaceStyles,
	popoverMobileDismissStyles,
	popoverMobileWrapperClassName
} from '~/ui/Popover'

interface IProps {
	options: Array<string>
	selectedChart: string
	onClick: (e: any) => void
}

export function ChartSelector({ options, selectedChart, onClick }: IProps) {
	return (
		<Ariakit.ComboboxProvider selectedValue={selectedChart} setSelectedValue={onClick}>
			<Ariakit.ComboboxSelect className={`${selectTriggerStyles('filter', 'md')} z-10 mr-auto`}>
				<span className="truncate">{selectedChart}</span>
				<Ariakit.ComboboxSelectArrow />
			</Ariakit.ComboboxSelect>

			<Ariakit.ComboboxPopover
				unmountOnHide
				hideOnInteractOutside
				gutter={6}
				wrapperProps={{ className: popoverMobileWrapperClassName }}
				className={popoverSurfaceStyles}
				portal
			>
				<Ariakit.PopoverDismiss className={popoverMobileDismissStyles}>
					<Icon name="x" className="size-5" />
				</Ariakit.PopoverDismiss>

				{options.map((option) => (
					<Ariakit.ComboboxItem value={option} key={option} className={popoverRowWithBorderStyles}>
						{option}
					</Ariakit.ComboboxItem>
				))}
			</Ariakit.ComboboxPopover>
		</Ariakit.ComboboxProvider>
	)
}
