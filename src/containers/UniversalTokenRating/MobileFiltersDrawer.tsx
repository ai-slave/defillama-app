import * as Ariakit from '@ariakit/react'
import { Button } from '~/ui/Button'
import { DialogBody, DialogFooter, DialogHeader, SideSheet } from '~/ui/Dialog'
import { Icon } from '~/ui/Icon'
import { UTR_SORT_OPTIONS, type UtrSort, type UtrSortKey } from './Leaderboard'

export type FilterOption = { key: string; name: string }

function toggleValue(values: Array<string>, value: string): Array<string> {
	return values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value]
}

function FilterSection({
	title,
	options,
	selected,
	onToggle
}: {
	title: string
	options: Array<FilterOption>
	selected: Array<string>
	onToggle: (key: string) => void
}) {
	return (
		<section className="flex flex-col gap-2">
			<h3 className="label-md text-primary">{title}</h3>
			<div role="group" aria-label={title} className="overflow-hidden rounded-lg border border-subtle">
				{options.map((option) => {
					const active = selected.includes(option.key)
					return (
						<button
							key={option.key}
							type="button"
							aria-pressed={active}
							onClick={() => onToggle(option.key)}
							className="hover-wash flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 border-b border-subtle px-3 py-2 text-left body-md last:border-b-0 sm:min-h-9 sm:body-sm"
						>
							<span className={active ? 'text-primary' : 'text-secondary'}>{option.name}</span>
							{active ? <Icon name="check" className="size-4 shrink-0 text-link" aria-hidden /> : null}
						</button>
					)
				})}
			</div>
		</section>
	)
}

export function MobileFiltersDrawer({
	open,
	onClose,
	fdvOptions,
	fdvRanges,
	setFdvRanges,
	sectorOptions,
	sectors,
	setSectors,
	statusOptions,
	listingStatuses,
	setListingStatuses,
	sort,
	setSort,
	canReset,
	onReset
}: {
	open: boolean
	onClose: () => void
	fdvOptions: Array<FilterOption>
	fdvRanges: Array<string>
	setFdvRanges: (values: Array<string>) => void
	sectorOptions: Array<FilterOption>
	sectors: Array<string>
	setSectors: (values: Array<string>) => void
	statusOptions: Array<FilterOption>
	listingStatuses: Array<string>
	setListingStatuses: (values: Array<string>) => void
	sort: UtrSort
	setSort: (sort: UtrSort) => void
	/** False while every filter and the sort are at their defaults. */
	canReset: boolean
	onReset: () => void
}) {
	// Every choice applies as it is made, so Done only closes the sheet.
	return (
		<SideSheet size="sm" open={open} onClose={onClose} portal unmountOnHide>
			<DialogHeader title="Filters and sorting" />
			<DialogBody>
				<FilterSection
					title="FDV range"
					options={fdvOptions}
					selected={fdvRanges}
					onToggle={(key) => setFdvRanges(toggleValue(fdvRanges, key))}
				/>
				<FilterSection
					title="Sector"
					options={sectorOptions}
					selected={sectors}
					onToggle={(key) => setSectors(toggleValue(sectors, key))}
				/>
				<FilterSection
					title="Exchange listing status"
					options={statusOptions}
					selected={listingStatuses}
					onToggle={(key) => setListingStatuses(toggleValue(listingStatuses, key))}
				/>
				<FilterSection
					title="Sort by"
					options={UTR_SORT_OPTIONS}
					selected={[sort.key]}
					onToggle={(key) => setSort({ key: key as UtrSortKey, desc: key !== 'rank' })}
				/>
			</DialogBody>
			<DialogFooter
				leading={
					// Reset disables itself once used; it stays focusable so focus does not drop to the page.
					<Button type="button" size="md" accessibleWhenDisabled disabled={!canReset} onClick={onReset}>
						Reset
					</Button>
				}
			>
				<Ariakit.DialogDismiss render={<Button type="button" variant="primary" size="md" />}>
					Done
				</Ariakit.DialogDismiss>
			</DialogFooter>
		</SideSheet>
	)
}
