import * as Ariakit from '@ariakit/react'
import { useRouter } from 'next/router'
import * as React from 'react'
import { CSVDownloadButton } from '~/components/CsvDownloadButton'
import { ResponsiveFilterLayout } from '~/components/Filters/ResponsiveFilterLayout'
import { Icon } from '~/components/Icon'
import { BasicLink } from '~/components/Link'
import { useYieldFilters } from '~/contexts/LocalStorage'
import { useMedia } from '~/hooks/useMedia'
import { Button, buttonStyles } from '~/ui/Button'
import { inputStyles } from '~/ui/Input'
import { Panel } from '~/ui/Panel'
import { popoverMobileDismissStyles, popoverMobileWrapperClassName, popoverSurfaceStyles } from '~/ui/Popover'
import { TableToolbar } from '~/ui/Toolbar'
import { Tooltip } from '~/ui/Tooltip'
import { trackYieldsEvent, YIELDS_EVENTS } from '~/utils/analytics/yields'
import { shouldResetYieldsPoolPage } from '../queryState'
import { pushYieldsQuery } from '../queryUpdates.client'
import { YieldFilterDropdowns } from './Dropdowns'
import { ResetAllYieldFilters } from './ResetAll'
import type { IYieldFiltersProps } from './types'

// Deterministic key for a filter selection so it can be compared regardless of
// query-param key order. Two selections that would produce the same URL match.
function filterSelectionKey(filters: Record<string, unknown>): string {
	return JSON.stringify(
		Object.keys(filters)
			.filter((key) => filters[key] != null)
			.sort()
			.map((key) => [key, filters[key]])
	)
}

// The "＋ Save view" pill: a single dashed-outline pill that opens ONE popover
// containing a save-current form + the saved list (with per-entry load/delete).
function SaveViewButton({ currentFilters }: { currentFilters: Record<string, string | string[] | undefined> }) {
	const { savedFilters, saveFilter, deleteFilter } = useYieldFilters()
	const router = useRouter()
	const [name, setName] = React.useState('')
	const popover = Ariakit.usePopoverStore({ placement: 'bottom-end' })

	const savedFiltersEntries = Object.entries(savedFilters)
	const count = savedFiltersEntries.length

	// Dirty = there is something to save (any active filter) that does not match a saved view.
	const dirty = (() => {
		const currentKey = filterSelectionKey(currentFilters)
		if (currentKey === '[]') return false
		return !savedFiltersEntries.some(([, filters]) => filterSelectionKey(filters) === currentKey)
	})()

	const canSave = name.trim().length > 0

	const handleSave = (e: React.FormEvent) => {
		e.preventDefault()
		if (!canSave) return
		const trimmed = name.trim()
		saveFilter(trimmed, currentFilters as Parameters<typeof saveFilter>[1])
		trackYieldsEvent(YIELDS_EVENTS.SAVED_FILTER_CREATE, { filter: trimmed })
		setName('')
	}

	const handleLoad = (viewName: string) => {
		const filters = savedFilters[viewName]
		if (!filters) return
		trackYieldsEvent(YIELDS_EVENTS.SAVED_FILTER_LOAD, { filter: viewName })
		const updates: Record<string, string | number | boolean | Array<string | number | boolean> | undefined> = {
			...filters
		}
		for (const key of Object.keys(router.query)) {
			if (!(key in filters)) updates[key] = undefined
		}
		void pushYieldsQuery(router, updates)
		popover.hide()
	}

	return (
		<Ariakit.PopoverProvider store={popover}>
			<Ariakit.PopoverDisclosure render={<Button type="button" variant="toggle" size="md" data-active={dirty} />}>
				<Icon name="plus" height={14} width={14} />
				Save view
				{count > 0 ? <span className="rounded-full bg-surface-elevated-1 px-1.5 label-xs">{count}</span> : null}
			</Ariakit.PopoverDisclosure>
			<Ariakit.Popover
				unmountOnHide
				hideOnInteractOutside
				gutter={6}
				overflowPadding={16}
				wrapperProps={{ className: popoverMobileWrapperClassName }}
				className={`${popoverSurfaceStyles} w-72`}
				portal
			>
				<Ariakit.PopoverDismiss className={popoverMobileDismissStyles}>
					<Icon name="x" className="size-5" />
				</Ariakit.PopoverDismiss>
				<div className="border-b border-subtle p-2">
					<form onSubmit={handleSave} className="flex gap-1.5">
						<input
							type="text"
							className={`${inputStyles} min-w-0 flex-1`}
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="Save current view…"
							maxLength={60}
							aria-label="Saved view name"
							autoFocus
						/>
						<Button type="submit" variant="primary" size="md" disabled={!canSave}>
							<Icon name="plus" className="size-3.5" />
							Save
						</Button>
					</form>
				</div>
				{count ? (
					<div className="max-h-64 overflow-y-auto p-1">
						{savedFiltersEntries.map(([viewName]) => (
							<div
								key={viewName}
								className="flex items-center gap-2 rounded-md px-2 py-1.5 body-sm text-secondary hover:bg-hover-row"
							>
								<button
									type="button"
									className="flex min-w-0 flex-1 items-center gap-2 text-left"
									onClick={() => handleLoad(viewName)}
								>
									<Icon name="bookmark" height={14} width={14} className="shrink-0 text-tertiary" />
									<span className="min-w-0 flex-1 truncate">{viewName}</span>
								</button>
								<Button
									type="button"
									variant="destructive"
									size="sm"
									square
									aria-label={`Delete ${viewName}`}
									onClick={() => deleteFilter(viewName)}
								>
									<Icon name="x" className="size-3.5" />
								</Button>
							</div>
						))}
					</div>
				) : (
					<div className="px-3 py-6 text-center body-sm text-tertiary">No saved views yet</div>
				)}
			</Ariakit.Popover>
		</Ariakit.PopoverProvider>
	)
}

// Unset --fill-icon renders the sprite's bookmark solid black.
const watchlistIconStyle: React.CSSProperties & Record<'--fill-icon', string> = { '--fill-icon': 'none' }

function WatchlistLink() {
	return (
		<Tooltip
			content="Watchlist"
			render={
				<BasicLink href="/yields/watchlist" style={watchlistIconStyle} data-umami-event="yields-watchlist-open" />
			}
			className={buttonStyles({ variant: 'secondary', size: 'md', square: true })}
		>
			<Icon name="bookmark" className="size-3.5 shrink-0" />
			<span className="sr-only">Watchlist</span>
		</Tooltip>
	)
}

export function YieldFilters({
	pathname: pathnameProp,
	showSearchOnMobile,
	saveView = true,
	tokenSearch,
	apyControls,
	curatedViews,
	resetFilters,
	resetFiltersLabel,
	prepareCsv,
	watchlist,
	...props
}: IYieldFiltersProps) {
	const isSmall = useMedia(`(max-width: 639px)`)

	const { pathname: routerPathname, query } = useRouter()
	const pathname = pathnameProp ?? routerPathname
	const currentFilters = (() => {
		if (!shouldResetYieldsPoolPage(pathname)) return query
		const { page: _page, ...filters } = query
		return filters
	})()
	const hasViewControls = Boolean(apyControls || saveView || prepareCsv || watchlist)

	return (
		<Panel padding="none">
			{/* View row: APY composition + window dials, then preset chips, view actions right.
			    One flex-wrap toolbar — two rows on narrow screens, one on wide. */}
			{hasViewControls || curatedViews ? (
				<TableToolbar className="gap-2 border-b border-subtle">
					{apyControls}
					{apyControls && curatedViews ? (
						<span className="mx-0.5 hidden h-5 w-px bg-border-medium sm:block" aria-hidden />
					) : null}
					{curatedViews ? <div className="hidden min-w-0 sm:block">{curatedViews}</div> : null}
					<div className="ml-auto flex items-center gap-2">
						{saveView ? (
							<span className="hidden sm:block">
								<SaveViewButton currentFilters={currentFilters} />
							</span>
						) : null}
						{prepareCsv ? <CSVDownloadButton size="md" prepareCsv={prepareCsv} smol /> : null}
						{watchlist ? <WatchlistLink /> : null}
					</div>
				</TableToolbar>
			) : null}

			{/* Query controls stay together as the final row governing the table below. */}
			<TableToolbar className="gap-2">
				{tokenSearch && (showSearchOnMobile || !isSmall) ? tokenSearch : null}
				<ResponsiveFilterLayout>
					{(nestedMenu) => <YieldFilterDropdowns {...props} pathname={pathname} nestedMenu={nestedMenu} />}
				</ResponsiveFilterLayout>
				{resetFilters ? (
					<div className="ml-auto">
						<ResetAllYieldFilters pathname={pathname} nestedMenu={false} label={resetFiltersLabel} />
					</div>
				) : null}
			</TableToolbar>
		</Panel>
	)
}
