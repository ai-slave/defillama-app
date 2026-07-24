import * as Ariakit from '@ariakit/react'
import {
	type ColumnFiltersState,
	createColumnHelper,
	getCoreRowModel,
	getFilteredRowModel,
	getSortedRowModel,
	type SortingState,
	useReactTable
} from '@tanstack/react-table'
import { useRouter } from 'next/router'
import * as React from 'react'
import { Announcement } from '~/components/Announcement'
import { BasicLink } from '~/components/Link'
import { selectTriggerStyles } from '~/components/Select/types'
import { VirtualTable } from '~/components/Table/Table'
import { useTableSearch } from '~/components/Table/utils'
import calendarEvents from '~/constants/calendar'
import { fetchAllProtocolEmissions } from '~/containers/Unlocks/api'
import type { ProtocolEmission } from '~/containers/Unlocks/api.types'
import Layout from '~/layout'
import { Icon } from '~/ui/Icon'
import { searchFieldIconStyles, searchFieldInlineWrapperStyles, searchFieldInputStyles } from '~/ui/Input'
import { Panel, PanelHeader, PanelTitle } from '~/ui/Panel'
import {
	popoverActionBarStyles,
	popoverActionButtonStyles,
	popoverMultiSelectCheckStyles,
	popoverRowWithBorderStyles,
	popoverSurfaceStyles,
	popoverMobileDismissStyles,
	popoverMobileWrapperClassName
} from '~/ui/Popover'
import { slug, toNiceDayMonthYear, toNiceHour } from '~/utils'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { formatPercent } from '~/utils/numberFormat'
import { withPerformanceLogging } from '~/utils/perf'
import { pushShallowQuery } from '~/utils/routerQuery'

export const getStaticProps = withPerformanceLogging('calendar', async () => {
	const res = await fetchAllProtocolEmissions()

	const emissions = res.map((protocol: ProtocolEmission) => {
		const unlocksByDate: Record<number, number> = {}
		for (const e of protocol.events ?? []) {
			if (e.timestamp < Date.now() / 1000 || (e.noOfTokens.length === 1 && e.noOfTokens[0] === 0)) continue
			unlocksByDate[e.timestamp] =
				(unlocksByDate[e.timestamp] ?? 0) +
				(e.noOfTokens.length === 2 ? e.noOfTokens[1] - e.noOfTokens[0] : e.noOfTokens[0])
		}
		const unlocksList = Object.entries(unlocksByDate)
		const maxUnlock = unlocksList.reduce((max, curr) => {
			if (max[1] < curr[1]) {
				return curr
			}
			return max
		}, unlocksList[0])

		const tSymbol = protocol.name === 'LooksRare' ? 'LOOKS' : (protocol.tokenPrice?.[0]?.symbol ?? null)

		return {
			...protocol,
			unlock: maxUnlock,
			tPrice: protocol.tokenPrice?.[0]?.price ?? null,
			tSymbol
		}
	})

	return {
		props: {
			emissions: emissions.filter((p) => p.unlock) || []
		},
		revalidate: maxAgeForNext([22])
	}
})

type CalendarRow = {
	name: string
	timestamp: number
	type: string
	link?: string
}

const columnHelper = createColumnHelper<CalendarRow>()

const options = ['Unlock', 'Close', 'Macro', 'Crypto']

export default function Protocols({ emissions }) {
	const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
	const [sorting, setSorting] = React.useState<SortingState>([{ id: 'timestamp', desc: false }])
	const router = useRouter()
	const { type } = router.query

	const selectedOptions = React.useMemo(() => {
		let selectedOptions: string[]
		if (type) {
			if (typeof type === 'string') {
				selectedOptions = type === 'All' ? [...options] : type === 'None' ? [] : [type]
			} else {
				selectedOptions = [...type]
			}
		} else selectedOptions = [...options]

		return selectedOptions
	}, [type])
	const selectedOptionsSet = React.useMemo(() => new Set(selectedOptions), [selectedOptions])
	const [mountedAtMs] = React.useState(() => Date.now())

	const allEvents = React.useMemo(() => {
		const events: Array<{ name: string; timestamp: number; type: string; link?: string }> = []
		for (const emission of emissions) {
			const tokens = emission.unlock[1]
			const tokenValue = emission.tPrice ? tokens * emission.tPrice : null
			const unlockPercent = tokenValue && emission.mcap ? (tokenValue / emission.mcap) * 100 : null
			if (unlockPercent === null || unlockPercent <= 4) continue
			events.push({
				name: `${emission.tSymbol} ${formatPercent(unlockPercent, { input: 'percent' })} unlock`,
				timestamp: emission.unlock[0] * 1e3,
				type: 'Unlock',
				link: emission.name
			})
		}

		for (const [eventType, items] of calendarEvents) {
			for (const [ts, name] of items) {
				events.push({
					name,
					timestamp: new Date(ts).getTime(),
					type: eventType
				})
			}
		}

		const filteredEvents: Array<{ name: string; timestamp: number; type: string; link?: string }> = []
		for (const event of events) {
			if (event.timestamp >= mountedAtMs && selectedOptionsSet.has(event.type)) {
				filteredEvents.push(event)
			}
		}
		filteredEvents.sort((a, b) => a.timestamp - b.timestamp)
		return filteredEvents
	}, [emissions, selectedOptionsSet, mountedAtMs])

	const instance = useReactTable({
		data: allEvents,
		columns: calendarColumns,
		state: {
			columnFilters,
			sorting
		},
		defaultColumn: {
			sortUndefined: 'last'
		},
		enableSortingRemoval: false,
		onSortingChange: (updater) => React.startTransition(() => setSorting(updater)),
		onColumnFiltersChange: (updater) => React.startTransition(() => setColumnFilters(updater)),
		getFilteredRowModel: getFilteredRowModel(),
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel()
	})
	const [_projectName, setProjectName] = useTableSearch({ instance, columnToSearch: 'name' })

	return (
		<Layout
			title="Crypto Events & Token Unlocks Calendar - DefiLlama"
			description="Track token unlocks, FOMC and CPI dates, halvings, and monthly or quarterly closes. Filter unlock, macro, crypto, and close events."
			canonicalUrl={`/calendar`}
		>
			<Announcement notCancellable>Want us to track other events? Tweet at @0xngmi on twitter!</Announcement>

			<Panel padding="none">
				<PanelHeader className="gap-4 *:last:ml-auto">
					<PanelTitle as="h1">Crypto Calendar</PanelTitle>

					<Ariakit.SelectProvider
						value={selectedOptions}
						setValue={(newOptions) => {
							void pushShallowQuery(router, { type: newOptions })
						}}
					>
						<Ariakit.Select className={selectTriggerStyles('filter', 'md')}>
							{selectedOptions.length > 0 ? (
								<>
									<span>Type: </span>
									<span className="text-link">
										{`${selectedOptions[1]}${
											selectedOptions.length > 1 ? ` + ${selectedOptions.length - 1} others` : ''
										}`}
									</span>
								</>
							) : (
								<span>Filter by type</span>
							)}
							<Ariakit.SelectArrow />
						</Ariakit.Select>
						<Ariakit.SelectPopover
							unmountOnHide
							gutter={6}
							hideOnInteractOutside
							wrapperProps={{ className: popoverMobileWrapperClassName }}
							className={popoverSurfaceStyles}
							portal
						>
							<Ariakit.PopoverDismiss className={popoverMobileDismissStyles}>
								<Icon name="x" className="size-5" />
							</Ariakit.PopoverDismiss>

							<span className={popoverActionBarStyles}>
								<button
									onClick={() => {
										void pushShallowQuery(router, { type: 'None' })
									}}
									className={popoverActionButtonStyles}
								>
									Clear
								</button>
								<button
									onClick={() => {
										void pushShallowQuery(router, { type: 'All' })
									}}
									className={popoverActionButtonStyles}
								>
									Toggle all
								</button>
							</span>

							{options.map((value) => (
								<Ariakit.SelectItem key={`calendar-type-${value}`} value={value} className={popoverRowWithBorderStyles}>
									<span>{value}</span>
									<span className={popoverMultiSelectCheckStyles(selectedOptionsSet.has(value))} aria-hidden>
										{selectedOptionsSet.has(value) ? <Icon name="check" className="size-3" /> : null}
									</span>
								</Ariakit.SelectItem>
							))}
						</Ariakit.SelectPopover>
					</Ariakit.SelectProvider>

					<label className={searchFieldInlineWrapperStyles}>
						<span className="sr-only">Search events...</span>
						<Icon name="search" height={16} width={16} className={searchFieldIconStyles} />
						<input
							name="search"
							onInput={(e) => setProjectName(e.currentTarget.value)}
							placeholder="Search events..."
							className={searchFieldInputStyles}
						/>
					</label>
				</PanelHeader>
				<VirtualTable instance={instance} />
			</Panel>
		</Layout>
	)
}

export const calendarColumns = [
	columnHelper.accessor('name', {
		header: 'Name',
		enableSorting: false,
		cell: ({ getValue, row }) => {
			return (
				<span className="relative flex items-center gap-2">
					<span className="vf-row-index shrink-0" aria-hidden="true" />
					{row.original.type === 'Unlock' ? (
						<BasicLink
							href={`/unlocks/${slug(row.original.link)}`}
							className="truncate text-sm font-medium text-link hover:underline"
						>
							{getValue()}
						</BasicLink>
					) : (
						getValue()
					)}
				</span>
			)
		},
		meta: {
			headerClassName: 'w-[min(220px,40vw)]'
		}
	}),
	columnHelper.accessor('type', {
		header: 'Type',
		meta: {
			headerClassName: 'w-[100px]'
		}
	}),
	columnHelper.accessor('timestamp', {
		id: 'timestamp',
		header: 'Date',
		cell: ({ getValue, row }) => {
			return <SimpleUpcomingEvent timestamp={getValue() / 1e3} name={row.original.name} />
		},
		meta: {
			headerClassName: 'w-[min(800px,40vw)]'
		}
	})
]

const SimpleUpcomingEvent = ({ timestamp, name }) => {
	const [nowMs, setNowMs] = React.useState(() => Date.now())
	const timeLeft = Math.max(0, timestamp - nowMs / 1e3)
	const days = Math.floor(timeLeft / 86400)
	const hours = Math.floor((timeLeft - 86400 * days) / 3600)
	const minutes = Math.floor((timeLeft - 86400 * days - 3600 * hours) / 60)
	const seconds = Math.floor(timeLeft - 86400 * days - 3600 * hours - minutes * 60)

	React.useEffect(() => {
		const id = setInterval(() => setNowMs(Date.now()), 1000)

		return () => clearInterval(id)
	}, [])

	return (
		<span className="flex items-center gap-2">
			<span>{name}</span>
			<span className="h-10 w-px bg-border-subtle" />
			<span className="flex items-center gap-1">
				<span className="flex size-8 items-center justify-center rounded-md bg-surface-elevated-1 text-sm">
					{days}D
				</span>
				<span className="flex size-8 items-center justify-center rounded-md bg-surface-elevated-1 text-sm">
					{hours}H
				</span>
				<span className="flex size-8 items-center justify-center rounded-md bg-surface-elevated-1 text-sm">
					{minutes}M
				</span>
				<span className="flex size-8 items-center justify-center rounded-md bg-surface-elevated-1 text-sm">
					{seconds}S
				</span>
			</span>
			<span className="h-10 w-px bg-border-subtle" />
			<span className="flex items-center justify-between gap-2">
				<span>{toNiceDayMonthYear(timestamp)}</span>
				<span>{toNiceHour(timestamp)}</span>
			</span>
		</span>
	)
}
