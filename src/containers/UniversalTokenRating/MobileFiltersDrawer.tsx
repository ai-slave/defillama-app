import { Drawer } from '~/containers/MarketMakers/Drawer'
import { Button } from '~/ui/Button'
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
		<div className="flex flex-col gap-1">
			<h4 className="px-1 label-md">{title}</h4>
			<div className="rounded-lg border border-subtle">
				{options.map((option) => {
					const active = selected.includes(option.key)
					return (
						<button
							key={option.key}
							type="button"
							onClick={() => onToggle(option.key)}
							className="flex w-full cursor-pointer items-center justify-between gap-3 border-b border-subtle px-3 py-2.5 text-left body-sm last:border-b-0 hover:bg-hover-row"
						>
							<span className={active ? 'text-primary' : 'text-secondary'}>{option.name}</span>
							{active ? <Icon name="check" height={14} width={14} className="shrink-0 text-link" /> : null}
						</button>
					)
				})}
			</div>
		</div>
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
	onReset: () => void
}) {
	if (!open) return null
	return (
		<Drawer open onClose={onClose} title="Filters & Sorting">
			<div className="flex flex-col gap-4 p-4">
				<FilterSection
					title="FDV Range"
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
					title="Exchange Listing Status"
					options={statusOptions}
					selected={listingStatuses}
					onToggle={(key) => setListingStatuses(toggleValue(listingStatuses, key))}
				/>
				<FilterSection
					title="Sort By"
					options={UTR_SORT_OPTIONS.map((option) => ({ key: option.key, name: option.name }))}
					selected={[sort.key]}
					onToggle={(key) => setSort({ key: key as UtrSortKey, desc: key !== 'rank' })}
				/>
				<div className="flex gap-3">
					<Button type="button" size="md" className="flex-1 justify-center" onClick={onReset}>
						Reset
					</Button>
					<Button type="button" variant="primary" size="md" className="flex-1 justify-center" onClick={onClose}>
						Apply
					</Button>
				</div>
			</div>
		</Drawer>
	)
}
