import * as Ariakit from '@ariakit/react'
import * as React from 'react'
import { selectTriggerStyles } from '~/components/Select/types'
import { popoverRowWithBorderStyles } from '~/ui/Popover'
import { ComboboxSurface } from '~/ui/PopoverSurface'

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

			<ComboboxSurface variant="list">
				{options.map((option) => (
					<Ariakit.ComboboxItem value={option} key={option} className={popoverRowWithBorderStyles}>
						{option}
					</Ariakit.ComboboxItem>
				))}
			</ComboboxSurface>
		</Ariakit.ComboboxProvider>
	)
}
