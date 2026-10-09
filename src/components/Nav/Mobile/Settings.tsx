import * as Ariakit from '@ariakit/react'
import { useProtocolsFilterState } from '~/components/Filters/useProtocolFilterState'
import { ComboboxSelectTrigger } from '~/components/Select/ComboboxSelectTrigger'
import { SelectCheckIcon } from '~/components/Select/SelectCheckIcon'
import { DARK_MODE, useDarkModeManager } from '~/contexts/LocalStorage'
import { Icon } from '~/ui/Icon'
import { popoverMultiSelectCheckStyles, popoverRowWithBorderStyles } from '~/ui/Popover'
import { ComboboxSurface } from '~/ui/PopoverSurface'

const EMPTY_FILTERS: Array<{ name: string; key: string }> = []

export function Settings({ tvlOptions = EMPTY_FILTERS }: { tvlOptions?: Array<{ name: string; key: string }> }) {
	const [darkMode, toggleDarkMode] = useDarkModeManager()

	const { selectedValues, setSelectedValues } = useProtocolsFilterState(tvlOptions)

	return (
		<Ariakit.ComboboxProvider selectedValue={selectedValues} setSelectedValue={setSelectedValues}>
			<ComboboxSelectTrigger className="-my-0.5 rounded-md bg-on-brand-control p-3 text-on-brand shadow-raised hover:bg-on-brand-control-hover focus-visible:bg-on-brand-control-hover active:bg-on-brand-control-hover">
				<span className="sr-only">Open Settings Menu</span>
				<Icon name="settings" height={16} width={16} />
			</ComboboxSelectTrigger>
			{/* Stays mounted: mobile nav control that must open instantly (#2640). */}
			<ComboboxSurface variant="panel" heading="Settings" unmountOnHide={false}>
				{tvlOptions.map((option) => (
					<Ariakit.ComboboxItem value={option.key} key={option.key} className={popoverRowWithBorderStyles}>
						{option.name}
						<Ariakit.ComboboxItemSelected>
							{(selected) => (
								<span className={popoverMultiSelectCheckStyles(selected)} aria-hidden>
									{selected ? <SelectCheckIcon /> : null}
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
						{darkMode ? <SelectCheckIcon /> : null}
					</span>
				</Ariakit.ComboboxItem>
			</ComboboxSurface>
		</Ariakit.ComboboxProvider>
	)
}
