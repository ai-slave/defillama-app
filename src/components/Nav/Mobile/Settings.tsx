import * as Ariakit from '@ariakit/react'
import { useDeferredValue, useState } from 'react'
import { useProtocolsFilterState } from '~/components/Filters/useProtocolFilterState'
import { DARK_MODE, useDarkModeManager } from '~/contexts/LocalStorage'
import { Button } from '~/ui/Button'
import { ComboboxSelectTrigger } from '~/ui/ComboboxSelectTrigger'
import { Icon } from '~/ui/Icon'
import { popoverMultiSelectCheckStyles, popoverRowWithBorderStyles } from '~/ui/Popover'
import { ComboboxSurface } from '~/ui/PopoverSurface'
import { Tooltip } from '~/ui/Tooltip'

const EMPTY_FILTERS: Array<{ name: string; key: string }> = []

export function Settings({ tvlOptions = EMPTY_FILTERS }: { tvlOptions?: Array<{ name: string; key: string }> }) {
	const [darkMode, toggleDarkMode] = useDarkModeManager()

	const { selectedValues, setSelectedValues } = useProtocolsFilterState(tvlOptions)
	const [open, setOpen] = useState(false)
	// Kept mounted, so its rows are built in a background render after hydration, or at once on an earlier tap.
	const rowsReady = useDeferredValue(true, false) || open

	return (
		<Ariakit.ComboboxProvider
			open={open}
			setOpen={setOpen}
			selectedValue={selectedValues}
			setSelectedValue={setSelectedValues}
		>
			<Tooltip
				content="Settings"
				render={
					<ComboboxSelectTrigger
						render={<Button variant="onBrand" size="lg" square aria-label="Open settings menu" className="-my-0.5" />}
					/>
				}
			>
				<Icon name="settings" className="size-4" />
			</Tooltip>
			{/* Stays mounted: mobile nav control that must open instantly (#2640). */}
			<ComboboxSurface variant="panel" heading="Settings" unmountOnHide={false}>
				{rowsReady ? (
					<>
						{tvlOptions.map((option) => (
							<Ariakit.ComboboxItem value={option.key} key={option.key} className={popoverRowWithBorderStyles}>
								{option.name}
								<Ariakit.ComboboxItemSelected>
									{(selected) => (
										<span className={popoverMultiSelectCheckStyles(selected)} aria-hidden>
											{selected ? <Icon name="check" className="size-3" aria-hidden /> : null}
										</span>
									)}
								</Ariakit.ComboboxItemSelected>
							</Ariakit.ComboboxItem>
						))}
						<Ariakit.ComboboxItem
							value={DARK_MODE}
							selectValueOnClick={false}
							onClick={() => toggleDarkMode()}
							className={popoverRowWithBorderStyles}
						>
							Dark Mode
							<span className={popoverMultiSelectCheckStyles(darkMode)} aria-hidden>
								{darkMode ? <Icon name="check" className="size-3" aria-hidden /> : null}
							</span>
						</Ariakit.ComboboxItem>
					</>
				) : null}
			</ComboboxSurface>
		</Ariakit.ComboboxProvider>
	)
}
