import * as Ariakit from '@ariakit/react'
import { useRouter } from 'next/router'
import * as React from 'react'
import { CSVDownloadButton } from '~/components/CsvDownloadButton'
import { ResponsiveFilterLayout } from '~/components/Filters/ResponsiveFilterLayout'
import { BasicLink } from '~/components/Link'
import { useYieldFilters } from '~/contexts/LocalStorage'
import { useMedia } from '~/hooks/useMedia'
import { Button } from '~/ui/Button'
import { CountBadge } from '~/ui/CountBadge'
import { Field } from '~/ui/Field'
import { focusNeighborOnLeave, showFieldErrors } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { Input } from '~/ui/Input'
import { NestedMenu } from '~/ui/NestedMenu'
import { Panel } from '~/ui/Panel'
import { PopoverSurface } from '~/ui/PopoverSurface'
import { TableToolbar } from '~/ui/Toolbar'
import { Tooltip } from '~/ui/Tooltip'
import { trackYieldsEvent, YIELDS_EVENTS } from '~/utils/analytics/yields'
import { shouldResetYieldsPoolPage } from '../queryState'
import { pushYieldsQuery } from '../queryUpdates.client'
import { countActiveYieldFilters, yieldsRouteParams } from './activeFilters'
import { YieldFilterDropdowns } from './Dropdowns'
import { ResetAllYieldFilters } from './ResetAll'
import { loadSavedView } from './savedView'
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

// Saved views re-render a task after a delete. With no view left, the popover's name field takes focus (its heading
// only shows on phones, where this popover never opens).
const focusNeighborViewOnLeave = focusNeighborOnLeave((node) =>
	node.closest('[data-dialog]')!.querySelector<HTMLElement>('input')
)

// The "＋ Save view" pill: a single dashed-outline pill that opens ONE popover
// containing a save-current form + the saved list (with per-entry load/delete).
export function SaveViewButton({
	currentFilters
}: {
	currentFilters: Record<string, string | Array<string> | undefined>
}) {
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

	const handleSave = (viewName: string) => {
		saveFilter(viewName, currentFilters as Parameters<typeof saveFilter>[1])
		trackYieldsEvent(YIELDS_EVENTS.SAVED_FILTER_CREATE, { filter: viewName })
		setName('')
	}

	const handleLoad = (viewName: string) => {
		const filters = savedFilters[viewName]
		if (!filters) return
		trackYieldsEvent(YIELDS_EVENTS.SAVED_FILTER_LOAD, { filter: viewName })
		void pushYieldsQuery(router, loadSavedView(filters, router.query))
		popover.hide()
	}

	return (
		<Ariakit.PopoverProvider store={popover}>
			<Ariakit.PopoverDisclosure render={<Button type="button" variant="toggle" size="md" data-active={dirty} />}>
				<Icon name="plus" className="size-3.5" />
				Save view
				{count > 0 ? <CountBadge count={count} /> : null}
			</Ariakit.PopoverDisclosure>
			<PopoverSurface variant="list" heading="Saved views" overflowPadding={16} width="md">
				<div className="border-b border-subtle p-2">
					{/* The surface unmounts on hide, so each opening starts with no error; the draft name lives here and survives it. */}
					<SaveViewForm name={name} setName={setName} onSave={handleSave} />
				</div>
				{count ? (
					<div className="max-h-64 overflow-y-auto p-1">
						{savedFiltersEntries.map(([viewName]) => (
							<div
								key={viewName}
								data-row
								className="flex items-center gap-2 rounded-md px-2 py-1.5 body-sm text-secondary hover:bg-hover-row"
							>
								<button
									type="button"
									className="flex min-w-0 flex-1 items-center gap-2 text-left"
									onClick={() => handleLoad(viewName)}
								>
									<Icon name="bookmark" className="size-3.5 shrink-0 text-tertiary" />
									<span className="min-w-0 flex-1 truncate">{viewName}</span>
								</button>
								<Tooltip
									content={`Delete ${viewName}`}
									render={
										<Button
											type="button"
											variant="ghostDestructive"
											size="sm"
											square
											aria-label={`Delete ${viewName}`}
											ref={focusNeighborViewOnLeave}
											onClick={() => deleteFilter(viewName)}
										/>
									}
								>
									<Icon name="trash-2" className="size-4" />
								</Tooltip>
							</div>
						))}
					</div>
				) : (
					<div className="px-3 py-6 text-center body-sm text-tertiary">No saved views yet</div>
				)}
			</PopoverSurface>
		</Ariakit.PopoverProvider>
	)
}

function SaveViewForm({
	name,
	setName,
	onSave
}: {
	name: string
	setName: (value: string) => void
	onSave: (name: string) => void
}) {
	const [submitted, setSubmitted] = React.useState(false)
	const trimmed = name.trim()
	const nameError = trimmed ? null : 'Enter a view name.'

	const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault()
		if (nameError) return showFieldErrors(e.currentTarget, () => setSubmitted(true))
		onSave(trimmed)
		// The field empties for the next view, which starts unchecked.
		setSubmitted(false)
	}

	return (
		<form noValidate onSubmit={handleSubmit}>
			<Field label="Save current view" error={submitted ? nameError : null}>
				{(control) => (
					<div className="flex gap-1.5">
						<Input
							{...control}
							className="min-w-0 flex-1"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="View name"
							maxLength={60}
							autoFocus
						/>
						<Button type="submit" variant="primary" size="md">
							<Icon name="plus" className="size-3.5" />
							Save
						</Button>
					</div>
				)}
			</Field>
		</form>
	)
}

function WatchlistLink() {
	return (
		<Tooltip
			content="Watchlist"
			render={
				<Button as={BasicLink} href="/yields/watchlist" size="md" square data-umami-event="yields-watchlist-open" />
			}
		>
			<Icon name="bookmark" className="size-4 shrink-0" />
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
	menuHeader,
	mobileActions,
	resetFilters,
	resetFiltersLabel,
	prepareCsv,
	watchlist,
	...props
}: IYieldFiltersProps) {
	// One tree per breakpoint; mounting both would double every popover store. False through
	// SSR and hydration, so the desktop tree keeps its `sm:` guards — a phone paints it first.
	const phone = useMedia(`(max-width: 639px)`)

	const { pathname: routerPathname, query } = useRouter()
	const pathname = pathnameProp ?? routerPathname
	const currentFilters = (() => {
		if (!shouldResetYieldsPoolPage(pathname)) return query
		const { page: _page, ...filters } = query
		return filters
	})()
	const hasViewControls = Boolean(apyControls || saveView || prepareCsv || watchlist)
	const activeFilterCount = countActiveYieldFilters(query, yieldsRouteParams(routerPathname))

	const viewActions = (
		<>
			{saveView ? (
				<span className="hidden sm:block">
					<SaveViewButton currentFilters={currentFilters} />
				</span>
			) : null}
			{prepareCsv ? <CSVDownloadButton size="md" prepareCsv={prepareCsv} smol /> : null}
			{watchlist ? <WatchlistLink /> : null}
		</>
	)
	const filterDropdowns = (
		<ResponsiveFilterLayout>
			{(nestedMenu) => <YieldFilterDropdowns {...props} pathname={pathname} nestedMenu={nestedMenu} />}
		</ResponsiveFilterLayout>
	)
	// The phone row drives its own menu: it needs the count on the trigger and the row's own
	// 32px rhythm, neither of which is the shared layout's to give.
	const filterMenu = (
		<React.Suspense fallback={null}>
			<NestedMenu
				label={
					<span className="flex items-center gap-1.5">
						Filters
						{activeFilterCount > 0 ? <CountBadge count={activeFilterCount} /> : null}
					</span>
				}
			>
				{menuHeader}
				<YieldFilterDropdowns
					{...props}
					pathname={pathname}
					nestedMenu
					{...(prepareCsv ? { prepareCsv } : {})}
					{...(resetFilters ? { resetFilters } : {})}
					{...(resetFiltersLabel ? { resetFiltersLabel } : {})}
				/>
			</NestedMenu>
		</React.Suspense>
	)
	// Desktop only; the phone row's reset is the menu's own footer action.
	const resetButton = resetFilters ? (
		<ResetAllYieldFilters
			pathname={pathname}
			nestedMenu={false}
			{...(resetFiltersLabel ? { label: resetFiltersLabel } : {})}
		/>
	) : null

	// Phone: one row — view and filters left, icon actions right. Token search leads the right
	// group so its selected-token label eats the gap. Presets, Verified, CSV and Clear go in
	// the menu.
	if (phone) {
		return (
			<Panel>
				<TableToolbar>
					{apyControls}
					{showSearchOnMobile ? tokenSearch : null}
					{filterMenu}
					{mobileActions || watchlist ? (
						<div className="ml-auto flex min-w-0 items-center gap-2">
							{mobileActions}
							{watchlist ? <WatchlistLink /> : null}
						</div>
					) : null}
				</TableToolbar>
			</Panel>
		)
	}

	// Without token search or preset chips (protocol yields) the bar is light enough for one
	// line: the APY view first, since it says what the numbers mean, a divider, then the filters
	// that pick the rows, with actions right.
	if (!tokenSearch && !curatedViews) {
		return (
			<Panel>
				<TableToolbar>
					{apyControls}
					{apyControls ? <span className="mx-0.5 hidden h-5 w-px bg-border-medium sm:block" aria-hidden /> : null}
					{filterDropdowns}
					{hasViewControls || resetFilters ? (
						<div className="ml-auto hidden items-center gap-2 sm:flex">
							{viewActions}
							{resetButton}
						</div>
					) : null}
				</TableToolbar>
			</Panel>
		)
	}

	return (
		<Panel>
			{/* View row: APY composition + window dials, then preset chips, view actions right. */}
			{hasViewControls || curatedViews ? (
				<TableToolbar divided>
					{apyControls}
					{apyControls && curatedViews ? (
						<span className="mx-0.5 hidden h-5 w-px bg-border-medium sm:block" aria-hidden />
					) : null}
					{curatedViews ? <div className="hidden min-w-0 sm:block">{curatedViews}</div> : null}
					<div className="ml-auto hidden items-center gap-2 sm:flex">{viewActions}</div>
				</TableToolbar>
			) : null}

			{/* Query controls stay together as the final row governing the table below. */}
			<TableToolbar>
				{tokenSearch}
				{filterDropdowns}
				{resetButton ? <div className="ml-auto hidden sm:block">{resetButton}</div> : null}
			</TableToolbar>
		</Panel>
	)
}
