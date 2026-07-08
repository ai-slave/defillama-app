import * as Ariakit from '@ariakit/react'
import * as React from 'react'
import { Icon } from '~/components/Icon'
import { selectTriggerStyles } from '~/components/Select/types'
import {
	popoverRowWithBorderStyles,
	popoverSurfaceStyles,
	popoverMobileDismissStyles,
	popoverMobileWrapperClassName
} from '~/ui/Popover'

interface IProps {
	options: string[]
	selectedChart: string
	onClick: (e: any) => void
}

export function ChartSelector({ options, selectedChart, onClick }: IProps) {
	const onItemClick = (chartType: string) => {
		onClick(chartType)
	}

	return (
		<Ariakit.SelectProvider value={selectedChart} setValue={onItemClick}>
			<Ariakit.Select className={`${selectTriggerStyles('filter', 'md')} z-10 mr-auto`}>
				<span className="truncate">{selectedChart}</span>
				<Ariakit.SelectArrow />
			</Ariakit.Select>

			<Ariakit.SelectPopover
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
					<Ariakit.SelectItem
						value={option}
						key={option}
						focusOnHover
						setValueOnClick={false}
						onClick={() => onItemClick(option)}
						className={popoverRowWithBorderStyles}
					>
						{option}
					</Ariakit.SelectItem>
				))}
			</Ariakit.SelectPopover>
		</Ariakit.SelectProvider>
	)
}
