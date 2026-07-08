import * as Ariakit from '@ariakit/react'
import { useProtocolsFilterState } from '~/components/Filters/useProtocolFilterState'
import { Icon } from '~/components/Icon'
import { DARK_MODE, useDarkModeManager } from '~/contexts/LocalStorage'
import {
	popoverMultiSelectCheckStyles,
	popoverMobileDismissStyles,
	popoverMobileWrapperClassName,
	popoverRowWithBorderStyles,
	popoverSurfaceStyles
} from '~/ui/Popover'

const EMPTY_FILTERS: { name: string; key: string }[] = []

export function Settings({ metricFilters = EMPTY_FILTERS }: { metricFilters?: { name: string; key: string }[] }) {
	const [darkMode, toggleDarkMode] = useDarkModeManager()

	const { selectedValues, setSelectedValues } = useProtocolsFilterState(metricFilters)

	return (
		<Ariakit.SelectProvider value={selectedValues} setValue={setSelectedValues}>
			<Ariakit.Select className="-my-0.5 rounded-md bg-[#445ed0] p-3 text-white shadow">
				<span className="sr-only">Open Settings Menu</span>
				<Icon name="settings" height={16} width={16} />
			</Ariakit.Select>
			<Ariakit.SelectPopover
				unmountOnHide={false}
				hideOnInteractOutside
				gutter={6}
				wrapperProps={{ className: popoverMobileWrapperClassName }}
				className={popoverSurfaceStyles}
			>
				<Ariakit.PopoverDismiss className={popoverMobileDismissStyles}>
					<Icon name="x" className="size-5" />
				</Ariakit.PopoverDismiss>

				<h2 className="px-3 py-2 label-sm text-secondary">Settings</h2>
				{metricFilters.map((option) => (
					<Ariakit.SelectItem value={option.key} key={option.key} className={popoverRowWithBorderStyles}>
						{option.name}
						<span className={popoverMultiSelectCheckStyles(selectedValues.includes(option.key))} aria-hidden>
							{selectedValues.includes(option.key) ? <Icon name="check" className="size-3" /> : null}
						</span>
					</Ariakit.SelectItem>
				))}
				<Ariakit.SelectItem value={DARK_MODE} onClick={() => toggleDarkMode()} className={popoverRowWithBorderStyles}>
					Dark Mode
					<span className={popoverMultiSelectCheckStyles(darkMode)} aria-hidden>
						{darkMode ? <Icon name="check" className="size-3" /> : null}
					</span>
				</Ariakit.SelectItem>
			</Ariakit.SelectPopover>
		</Ariakit.SelectProvider>
	)
}
