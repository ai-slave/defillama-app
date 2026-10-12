import * as Ariakit from '@ariakit/react'
import { useDeferredValue, useState } from 'react'
import { useProtocolsFilterState } from '~/components/Filters/useProtocolFilterState'
import { DARK_MODE, useDarkModeManager } from '~/contexts/LocalStorage'
import { Button } from '~/ui/Button'
import { ComboboxSelectTrigger } from '~/ui/ComboboxSelectTrigger'
import { Icon } from '~/ui/Icon'
import { ComboboxSurface, PopoverList, PopoverRow } from '~/ui/PopoverSurface'
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
						arrow={false}
						render={<Button variant="onBrand" size="lg" square aria-label="Open settings menu" className="-my-0.5" />}
					/>
				}
			>
				<Icon name="settings" className="size-4" />
			</Tooltip>
			{/* Stays mounted: mobile nav control that must open instantly (#2640). */}
			<ComboboxSurface variant="panel" heading="Settings" unmountOnHide={false}>
				{rowsReady ? (
					<PopoverList divided>
						{tvlOptions.map((option) => (
							<PopoverRow
								key={option.key}
								render={<Ariakit.ComboboxItem value={option.key} />}
								check="box"
								checked={selectedValues.includes(option.key)}
							>
								{option.name}
							</PopoverRow>
						))}
						<PopoverRow
							render={<Ariakit.ComboboxItem value={DARK_MODE} selectValueOnClick={false} />}
							onClick={() => toggleDarkMode()}
							check="box"
							checked={darkMode}
						>
							Dark Mode
						</PopoverRow>
					</PopoverList>
				) : null}
			</ComboboxSurface>
		</Ariakit.ComboboxProvider>
	)
}
