import { type ColumnFiltersState, createColumnHelper, type SortingState, useTable } from '@tanstack/react-table'
import { useRouter } from 'next/router'
import * as React from 'react'
import { Announcement } from '~/components/Announcement'
import { BasicLink } from '~/components/Link'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { filteredTableFeatures } from '~/components/Table/features/filtering'
import { useTableSearch } from '~/components/Table/utils'
import { VirtualTable } from '~/components/Table/VirtualTable'
import calendarEvents from '~/constants/calendar'
import { fetchAllProtocolEmissions } from '~/containers/Unlocks/api'
import type { ProtocolEmission } from '~/containers/Unlocks/api.types'
import { type CalendarEvent, selectCalendarEvents } from '~/containers/Unlocks/calendarEvents'
import { formatUnlockDate, formatUnlockTime } from '~/containers/Unlocks/dateFormat'
import { getCliffEmissionAmount } from '~/containers/Unlocks/eventAmount'
import { useNowSeconds } from '~/hooks/useNowSeconds'
import Layout from '~/layout'
import { Icon } from '~/ui/Icon'
import {
	Input,
	searchFieldIconStyles,
	searchFieldInlineWrapperStyles,
	searchFieldInputPlacementStyles
} from '~/ui/Input'
import { Panel, PanelHeader, PanelTitle } from '~/ui/Panel'
import { slug } from '~/utils'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { formatPercent } from '~/utils/numberFormat'
import { withPerformanceLogging } from '~/utils/perf'

type CalendarEmission = ProtocolEmission & {
	unlock: [timestamp: number, amount: number]
	tPrice: number | null
	tSymbol: string | null
}

export const getStaticProps = withPerformanceLogging('calendar', async () => {
	const res = await fetchAllProtocolEmissions()
	const nowSec = Date.now() / 1000

	const emissions: Array<CalendarEmission> = []
	for (const protocol of res) {
		const unlocksByDate = new Map<number, number>()
		for (const e of protocol.events) {
			if (e.timestamp < nowSec) continue
			const amount = getCliffEmissionAmount(e)
			if (amount === null || amount <= 0) continue
			unlocksByDate.set(e.timestamp, (unlocksByDate.get(e.timestamp) ?? 0) + amount)
		}
		let maxUnlock: CalendarEmission['unlock'] | null = null
		for (const [timestamp, amount] of unlocksByDate) {
			if (!maxUnlock || amount > maxUnlock[1]) maxUnlock = [timestamp, amount]
		}
		if (!maxUnlock) continue

		const tSymbol = protocol.name === 'LooksRare' ? 'LOOKS' : (protocol.tokenPrice?.[0]?.symbol ?? null)

		emissions.push({
			...protocol,
			unlock: maxUnlock,
			tPrice: protocol.tokenPrice?.[0]?.price ?? null,
			tSymbol
		})
	}

	return {
		props: {
			emissions
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

const columnHelper = createColumnHelper<typeof filteredTableFeatures, CalendarRow>()

export default function Protocols({ emissions }: { emissions: Array<CalendarEmission> }) {
	const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
	const [sorting, setSorting] = React.useState<SortingState>([{ id: 'timestamp', desc: false }])
	const router = useRouter()
	const nowSec = useNowSeconds()

	const events = React.useMemo(() => {
		const events: Array<CalendarEvent> = []
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
				if (!ts || !name) continue
				events.push({
					name,
					timestamp: new Date(ts).getTime(),
					type: eventType
				})
			}
		}
		return events
	}, [emissions])
	const { typeOptions, rows } = React.useMemo(
		() => selectCalendarEvents(events, nowSec * 1e3, router.query),
		[events, nowSec, router.query]
	)

	const instance = useTable({
		features: filteredTableFeatures,
		data: rows,
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
		onColumnFiltersChange: (updater) => React.startTransition(() => setColumnFilters(updater))
	})
	const [_projectName, setProjectName] = useTableSearch({
		instance,
		columnToSearch: 'name'
	})

	return (
		<Layout
			title="Crypto Events & Token Unlocks Calendar - DefiLlama"
			description="Track token unlocks, FOMC and CPI dates, halvings, and monthly or quarterly closes. Filter unlock, macro, crypto, and close events."
			canonicalUrl="/calendar"
		>
			<Announcement notCancellable>Want us to track other events? Tweet at @0xngmi on twitter!</Announcement>

			<Panel padding="none">
				<PanelHeader>
					<PanelTitle as="h1">Crypto Calendar</PanelTitle>
					<label className={searchFieldInlineWrapperStyles}>
						<span className="sr-only">Search events…</span>
						<Icon name="search" className={searchFieldIconStyles} />
						<Input
							name="search"
							onInput={(e) => setProjectName(e.currentTarget.value)}
							placeholder="Search events…"
							className={searchFieldInputPlacementStyles}
						/>
					</label>
					{typeOptions.length > 1 ? (
						<SelectWithCombobox
							allValues={typeOptions}
							includeQueryKey="type"
							excludeQueryKey="excludeType"
							label="Type"
							labelType="regular"
							variant="filter"
							size="md"
							nestedMenu={false}
						/>
					) : null}
				</PanelHeader>
				<VirtualTable table={instance} />
			</Panel>
		</Layout>
	)
}

const calendarColumns = columnHelper.columns([
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
							className="truncate label-md text-link hover:underline"
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
	columnHelper.accessor((row) => row.timestamp ?? undefined, {
		id: 'timestamp',
		header: 'Date',
		cell: ({ getValue, row }) => {
			return <SimpleUpcomingEvent timestamp={getValue() / 1e3} name={row.original.name} />
		},
		meta: {
			headerClassName: 'w-[min(800px,40vw)]'
		}
	})
])

function SimpleUpcomingEvent({ timestamp, name }: { timestamp: number; name: string }) {
	const nowSec = useNowSeconds(undefined, 1000)
	const timeLeft = Math.max(0, timestamp - nowSec)
	const days = Math.floor(timeLeft / 86_400)
	const hours = Math.floor((timeLeft - 86_400 * days) / 3600)
	const minutes = Math.floor((timeLeft - 86_400 * days - 3600 * hours) / 60)
	const seconds = Math.floor(timeLeft - 86_400 * days - 3600 * hours - minutes * 60)

	return (
		<span className="flex items-center gap-2">
			<span>{name}</span>
			<span className="h-10 w-px bg-border-subtle" />
			<span className="flex items-center gap-1">
				<span className="flex size-8 items-center justify-center rounded-md bg-surface-elevated-1 body-md">
					{days}D
				</span>
				<span className="flex size-8 items-center justify-center rounded-md bg-surface-elevated-1 body-md">
					{hours}H
				</span>
				<span className="flex size-8 items-center justify-center rounded-md bg-surface-elevated-1 body-md">
					{minutes}M
				</span>
				<span className="flex size-8 items-center justify-center rounded-md bg-surface-elevated-1 body-md">
					{seconds}S
				</span>
			</span>
			<span className="h-10 w-px bg-border-subtle" />
			<span className="flex items-center justify-between gap-2">
				<span>{formatUnlockDate(timestamp)}</span>
				<span>{formatUnlockTime(timestamp)}</span>
			</span>
		</span>
	)
}
