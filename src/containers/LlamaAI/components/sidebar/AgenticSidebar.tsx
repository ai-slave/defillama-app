import { useMutation } from '@tanstack/react-query'
import type { Virtualizer } from '@tanstack/react-virtual'
import {
	type CSSProperties,
	memo,
	type ReactNode,
	type Ref,
	useCallback,
	useEffect,
	useEffectEvent,
	useMemo,
	useRef,
	useState
} from 'react'
import { BasicLink } from '~/components/Link'
import { useLlamaAIChrome } from '~/containers/LlamaAI/chrome'
import { DeleteSessionDialog, SessionListFocusContext } from '~/containers/LlamaAI/components/DeleteSessionDialog'
import { FreeUsageNote } from '~/containers/LlamaAI/components/FreeUsageNote'
import { AgenticSessionItem } from '~/containers/LlamaAI/components/sidebar/AgenticSessionItem'
import { SearchResults } from '~/containers/LlamaAI/components/sidebar/SearchResults'
import { useSemanticSearch } from '~/containers/LlamaAI/hooks/useSemanticSearch'
import { ProjectsSidebarSection, SIDEBAR_PROJECTS_OPEN_KEY } from '~/containers/LlamaAI/projects/ProjectsSidebarSection'
import { useTerminalEnabled } from '~/containers/LlamaAI/terminal/terminalViewStore'
import type { ChatSession, FreeUsage } from '~/containers/LlamaAI/types'
import { compareSessionsByActivity } from '~/containers/LlamaAI/utils/sessionActivityOrder'
import { useAiBalance } from '~/containers/Subscription/useTopup'
import { setStorageItem } from '~/contexts/localStorageStore'
import { useStableCallback } from '~/hooks/useStableCallback'
import { useVirtualItems } from '~/hooks/useVirtualItems'
import { Button, StableLabel } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { keepFocus } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { Input, searchFieldIconStyles, searchFieldInputPlacementStyles } from '~/ui/Input'
import { LoadingSpinner } from '~/ui/Loaders'
import { NoResults } from '~/ui/NoResults'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { InlineStatus, LoadingIndicator } from '~/ui/Status'
import { Tooltip } from '~/ui/Tooltip'
import { trackUmamiEvent } from '~/utils/analytics/umami'
import { formatUsd } from '~/utils/numberFormat'

/* One row recipe for every sidebar list item: 32px, body-sm, hover wash, brand tint when active. */
export const SIDEBAR_ROW_SURFACE =
	'flex items-center gap-1.5 rounded-md body-sm text-primary not-disabled:not-aria-disabled:hover:bg-hover-row focus-within:bg-hover-row data-[active=true]:bg-brand-muted data-[active=true]:text-link'
export const SIDEBAR_ROW = `${SIDEBAR_ROW_SURFACE} px-2 py-1.5`

interface AgenticSidebarProps {
	sessions: Array<ChatSession>
	isLoading: boolean
	loadError?: string | null
	currentSessionId: string | null
	restoringSessionId: string | null
	onSessionSelect: (sessionId: string) => void
	onNewChat: () => void
	onDelete: (sessionId: string, projectId?: string | null) => Promise<void>
	shouldAnimate?: boolean
	onOpenSettings?: () => void
	onOpenBalanceSettings?: () => void
	showBalance?: boolean
	hasCustomInstructions?: boolean
	onBulkDelete?: (sessionIds: Array<string>) => Promise<void>
	onSearchMatchClick?: (sessionId: string, messageId: string) => void
	hasMoreSessions?: boolean
	isFetchingMoreSessions?: boolean
	loadMoreSessionsError?: string | null
	onLoadMoreSessions?: () => void
	currentProjectId?: string | null
	currentSessionProjectId?: string | null
	alertsCount?: number | null
	onOpenAlerts?: () => void
	folded?: boolean
	place?: SidebarPlace
	onSwitchPlace?: () => void
	searchOpen?: boolean
	onSearchOpenChange?: (open: boolean) => void
	emptyHistoryText?: string
	freeUsage?: FreeUsage | null
}

function getGroupName(lastActivity: string, now: number) {
	const t = new Date(lastActivity).getTime()
	return t >= now - 24 * 60 * 60 * 1000
		? 'Today'
		: t >= now - 48 * 60 * 60 * 1000
			? 'Yesterday'
			: t >= now - 7 * 24 * 60 * 60 * 1000
				? 'This week'
				: t >= now - 30 * 24 * 60 * 60 * 1000
					? 'This month'
					: 'Older'
}

type VirtualItem =
	| { type: 'header'; groupName: string; isFirst: boolean }
	| { type: 'session'; session: ChatSession; groupName: string }
	| { type: 'loader'; isFetching: boolean; loadError: string | null; onLoadMore?: () => void }

const VirtualizedSidebarItem = memo(function VirtualizedSidebarItem({
	item,
	itemStyle,
	currentSessionId,
	restoringSessionId,
	onSessionSelect,
	onDelete,
	selectMode,
	isSelected,
	onToggleSelect
}: {
	item: VirtualItem
	itemStyle: CSSProperties
	currentSessionId: string | null
	restoringSessionId: string | null
	onSessionSelect: (sessionId: string) => void
	onDelete: (sessionId: string, projectId?: string | null) => Promise<void>
	selectMode: boolean
	isSelected: boolean
	onToggleSelect: (sessionId: string) => void
}) {
	if (item.type === 'header') {
		return (
			<h2
				style={itemStyle}
				className={`flex items-center gap-1 label-sm text-secondary ${item.isFirst ? 'pt-0' : 'pt-3'}`}
			>
				{item.groupName === 'Pinned' ? <Icon name="pin" className="size-3.5 shrink-0" /> : null}
				{item.groupName}
			</h2>
		)
	}

	if (item.type === 'loader') {
		if (item.loadError) {
			return (
				<div style={itemStyle} className="flex items-center justify-center py-1">
					<Button type="button" size="sm" variant="ghost" onClick={() => item.onLoadMore?.()}>
						Retry loading chats
					</Button>
				</div>
			)
		}

		return (
			<div style={itemStyle} className="flex items-center justify-center py-2 text-tertiary">
				{item.isFetching ? <LoadingSpinner size={12} /> : null}
			</div>
		)
	}

	return (
		<AgenticSessionItem
			session={item.session}
			isActive={item.session.sessionId === currentSessionId}
			onSessionSelect={onSessionSelect}
			onDelete={onDelete}
			isRestoring={restoringSessionId === item.session.sessionId}
			style={itemStyle}
			selectMode={selectMode}
			isSelected={isSelected}
			onToggleSelect={onToggleSelect}
		/>
	)
})

export function AgenticSidebar(props: AgenticSidebarProps) {
	const { folded = false, place = 'chat', alertsCount = null } = props
	return folded ? (
		<SidebarRail {...props} place={place} alertsCount={alertsCount} />
	) : (
		<SidebarPanel {...props} place={place} alertsCount={alertsCount} />
	)
}

function SidebarPanel({
	sessions,
	isLoading,
	loadError = null,
	currentSessionId,
	restoringSessionId,
	onSessionSelect,
	onNewChat,
	onDelete,
	shouldAnimate = false,
	onOpenSettings,
	onOpenBalanceSettings,
	showBalance = false,
	hasCustomInstructions,
	onBulkDelete,
	onSearchMatchClick,
	hasMoreSessions = false,
	isFetchingMoreSessions = false,
	loadMoreSessionsError = null,
	onLoadMoreSessions,
	currentProjectId = null,
	currentSessionProjectId = null,
	alertsCount,
	onOpenAlerts,
	place,
	onSwitchPlace,
	searchOpen = false,
	onSearchOpenChange,
	emptyHistoryText = "You don't have any chats yet",
	freeUsage
}: AgenticSidebarProps & { place: SidebarPlace; alertsCount: number | null }) {
	const { hideSidebar, isFullscreen, fullscreenLocked, toggleFullscreen } = useLlamaAIChrome()
	const showsFullscreen = isFullscreen || fullscreenLocked
	const newChatRef = useRef<HTMLButtonElement>(null)
	const sidebarRef = useRef<HTMLDivElement>(null)
	const searchToggleRef = useRef<HTMLButtonElement>(null)
	const scrollContainerRef = useRef<HTMLDivElement>(null)
	const projectsSectionRef = useRef<HTMLDivElement>(null)
	const [projectsSectionHeight, setProjectsSectionHeight] = useState(0)
	const [selectMode, setSelectMode] = useState(false)
	const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set())
	const {
		query: searchQuery,
		setQuery: setSearchQuery,
		results: searchResults,
		isSearching,
		failed: searchFailed,
		retry: retrySearch,
		clear: clearSearch
	} = useSemanticSearch(!selectMode)

	const toggleSelect = useCallback((sessionId: string) => {
		setSelectedSessionIds((prev) => {
			const next = new Set(prev)
			if (next.has(sessionId)) {
				next.delete(sessionId)
			} else {
				next.add(sessionId)
			}
			return next
		})
	}, [])

	const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)
	const bulkDeleteRef = useRef<HTMLButtonElement>(null)
	// Leaving select mode removes the footer and its Delete button; the Select toggle that replaces Cancel takes focus.
	const selectToggleRef = useRef<HTMLButtonElement>(null)
	const bulkDeletion = useMutation({ mutationFn: (ids: Array<string>) => onBulkDelete!(ids) })

	const exitSelectMode = useCallback(() => {
		setSelectMode(false)
		setSelectedSessionIds(new Set())
	}, [])

	const [nowMs] = useState(() => Date.now())
	const trimmedSearchQuery = searchQuery.trim()

	const shownSessions = useMemo(() => sessions.filter((s) => !s.projectId), [sessions])
	const hasShownSessions = shownSessions.length > 0
	const isSearchShown = searchOpen || searchQuery !== ''
	const openSearch = () => onSearchOpenChange?.(true)
	const closeSearch = () => {
		clearSearch()
		setSelectedSessionIds(new Set())
		onSearchOpenChange?.(false)
	}
	// Clearing from the field (× or Escape) removes the field with its focus; the search toggle takes it.
	const clearSearchField = () => keepFocus(closeSearch, () => searchToggleRef.current)

	const filteredSessions = useMemo(() => {
		if (!trimmedSearchQuery) return shownSessions
		return shownSessions.filter((s) => s.title.toLowerCase().includes(trimmedSearchQuery.toLowerCase()))
	}, [shownSessions, trimmedSearchQuery])

	const selectedIds = useMemo(() => {
		const ids: Array<string> = []
		for (const session of filteredSessions) {
			if (selectedSessionIds.has(session.sessionId)) ids.push(session.sessionId)
		}
		return ids
	}, [filteredSessions, selectedSessionIds])

	const allSelected = filteredSessions.length > 0 && selectedIds.length === filteredSessions.length

	const { pinnedSessions, unpinnedSessions } = useMemo(() => {
		const pinned = filteredSessions.filter((s) => s.isPinned).sort(compareSessionsByActivity)
		const unpinned = filteredSessions.filter((s) => !s.isPinned).sort(compareSessionsByActivity)
		return { pinnedSessions: pinned, unpinnedSessions: unpinned }
	}, [filteredSessions])

	const groupedSessions = useMemo(() => {
		const groups: Record<string, Array<ChatSession>> = {}
		for (const session of unpinnedSessions) {
			const groupName = getGroupName(session.lastActivity, nowMs)
			const group = groups[groupName] ?? (groups[groupName] = [])
			group.push(session)
		}
		return Object.entries(groups).sort((a, b) => Date.parse(b[1][0].lastActivity) - Date.parse(a[1][0].lastActivity))
	}, [unpinnedSessions, nowMs])

	const virtualItems = useMemo(() => {
		const items: Array<VirtualItem> = []
		if (pinnedSessions.length > 0) {
			items.push({ type: 'header', groupName: 'Pinned', isFirst: true })
			for (const session of pinnedSessions) {
				items.push({ type: 'session', session, groupName: 'Pinned' })
			}
		}
		for (let groupIndex = 0; groupIndex < groupedSessions.length; groupIndex++) {
			const [groupName, groupSessions] = groupedSessions[groupIndex]
			items.push({ type: 'header', groupName, isFirst: pinnedSessions.length === 0 && groupIndex === 0 })
			for (const session of groupSessions) {
				items.push({ type: 'session', session, groupName })
			}
		}
		if (hasMoreSessions && !trimmedSearchQuery) {
			items.push({
				type: 'loader',
				isFetching: isFetchingMoreSessions,
				loadError: loadMoreSessionsError,
				onLoadMore: onLoadMoreSessions
			})
		}
		return items
	}, [
		pinnedSessions,
		groupedSessions,
		hasMoreSessions,
		isFetchingMoreSessions,
		loadMoreSessionsError,
		onLoadMoreSessions,
		trimmedSearchQuery
	])

	const handleVirtualizerChange = useStableCallback((instance: Virtualizer<HTMLDivElement, Element>) => {
		if (
			loadMoreSessionsError ||
			!hasMoreSessions ||
			isFetchingMoreSessions ||
			trimmedSearchQuery ||
			!onLoadMoreSessions
		)
			return

		const virtualizedItems = instance.getVirtualItems()
		const lastVirtualItem = virtualizedItems[virtualizedItems.length - 1]
		if (!lastVirtualItem || lastVirtualItem.index < instance.options.count - 3) return

		onLoadMoreSessions()
	})

	const { items: virtualizedItems, totalSize } = useVirtualItems({
		count: virtualItems.length,
		getScrollElement: () => scrollContainerRef.current,
		estimateSize: (index) => {
			const item = virtualItems[index]
			if (item.type === 'header') {
				return item.isFirst ? 20 : 32
			}
			if (item.type === 'loader') {
				return 36
			}
			return 32
		},
		overscan: 5,
		scrollMargin: projectsSectionHeight,
		onChange: handleVirtualizerChange
	})

	useEffect(() => {
		const el = projectsSectionRef.current
		if (!el) return
		const updateHeight = () => setProjectsSectionHeight(el.offsetHeight)
		updateHeight()
		const observer = new ResizeObserver(updateHeight)
		observer.observe(el)
		return () => observer.disconnect()
	}, [])

	const onClickOutside = useEffectEvent((event: MouseEvent) => {
		// A tap in any Ariakit dialog, alertdialog, menu or popover, or on a modal's backdrop, belongs to that layer.
		if (
			event.target instanceof Element &&
			sidebarRef.current &&
			!sidebarRef.current.contains(event.target) &&
			!event.target.closest('[data-dialog], [data-backdrop], [role="menu"]') &&
			document.documentElement.clientWidth < 1024
		) {
			hideSidebar()
		}
	})

	useEffect(() => {
		document.addEventListener('mousedown', onClickOutside)
		return () => document.removeEventListener('mousedown', onClickOutside)
	}, [])

	return (
		<SessionListFocusContext.Provider value={newChatRef}>
			<Card
				as="aside"
				padding="none"
				ref={sidebarRef}
				className={`llamaai-agentic-sidebar relative flex size-full max-w-[272px] flex-col max-lg:absolute max-lg:top-0 max-lg:right-0 max-lg:bottom-0 max-lg:left-0 max-lg:z-10 lg:mr-2 ${shouldAnimate ? 'motion-safe:animate-[slideInRight_0.15s_ease-out]' : ''}`}
			>
				<header className="flex flex-col gap-2 border-b border-subtle p-4">
					<div className="-mx-2 flex items-center gap-1">
						<SidebarToggles
							folded={false}
							searchOpen={isSearchShown}
							onSearch={isSearchShown ? closeSearch : openSearch}
							searchRef={searchToggleRef}
						/>
						<Tooltip
							content={
								fullscreenLocked
									? 'Needs a wider window to show the DefiLlama menu'
									: showsFullscreen
										? 'Exit fullscreen'
										: 'Enter fullscreen'
							}
							render={
								<Button
									type="button"
									size="md"
									variant="ghost"
									square
									className="ml-auto max-lg:hidden"
									accessibleWhenDisabled
									disabled={fullscreenLocked}
									onClick={toggleFullscreen}
									data-umami-event="llamaai-fullscreen-toggle"
									data-umami-event-action={isFullscreen ? 'exit' : 'enter'}
									data-umami-event-source="sidebar_header"
								/>
							}
						>
							<Icon name={showsFullscreen ? 'shrink' : 'expand'} className="size-4" />
							<span className="sr-only">{showsFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}</span>
						</Tooltip>
					</div>

					{isSearchShown ? (
						<div className="relative w-full min-w-0">
							<Icon name="search" className={searchFieldIconStyles} />
							<Input
								type="text"
								autoFocus
								data-autofocus
								value={searchQuery}
								onChange={(e) => {
									setSearchQuery(e.target.value)
									setSelectedSessionIds(new Set())
								}}
								onKeyDown={(e) => {
									if (e.key !== 'Escape') return
									e.stopPropagation()
									clearSearchField()
								}}
								aria-label="Search sessions"
								placeholder="Search"
								className={`${searchFieldInputPlacementStyles} pr-9`}
							/>
							<span className="absolute top-0 right-1 bottom-0 my-auto flex items-center gap-1">
								{isSearching ? (
									<span role="status" className="flex size-6 items-center justify-center text-tertiary">
										<LoadingSpinner size={12} />
										<span className="sr-only">Searching</span>
									</span>
								) : (
									<Button
										type="button"
										variant="ghost"
										size="sm"
										square
										aria-label="Clear session search"
										onClick={clearSearchField}
									>
										<Icon name="x" className="size-3.5" />
									</Button>
								)}
							</span>
						</div>
					) : null}

					<nav aria-label="LlamaAI menu" className="flex flex-col gap-2">
						<SidebarDestinations
							folded={false}
							place={place}
							onNewChat={onNewChat}
							onSwitchPlace={onSwitchPlace}
							newChatRef={newChatRef}
						/>
					</nav>
				</header>

				<div
					ref={scrollContainerRef}
					className="flex-1 [scrollbar-width:thin] [scrollbar-gutter:stable] overflow-auto overscroll-contain"
				>
					<div ref={projectsSectionRef} className="flex flex-col gap-1 pt-2">
						{onOpenAlerts ? (
							<div className="flex flex-col px-2">
								<AlertsItem folded={false} alertsCount={alertsCount} onOpenAlerts={onOpenAlerts} />
							</div>
						) : null}
						<ProjectsSidebarSection
							sessions={sessions}
							currentProjectId={currentProjectId}
							currentSessionProjectId={currentSessionProjectId}
							currentSessionId={currentSessionId}
							restoringSessionId={restoringSessionId}
							onSessionSelect={onSessionSelect}
							onDelete={onDelete}
						/>
						<div className="flex min-h-6 items-center justify-between px-4 pt-4">
							<h2 className="label-sm text-secondary">History</h2>
							{isLoading || hasShownSessions ? (
								<Button
									type="button"
									size="sm"
									variant="ghost"
									ref={selectToggleRef}
									data-active={selectMode}
									onClick={selectMode ? exitSelectMode : () => setSelectMode(true)}
									disabled={isLoading && !hasShownSessions}
									className="-mr-2 disabled:invisible"
								>
									<Icon name={selectMode ? 'x' : 'check'} className="size-3.5" />
									<StableLabel labels={['Select', 'Cancel']} current={selectMode ? 'Cancel' : 'Select'} />
								</Button>
							) : null}
						</div>
					</div>

					<nav className="px-4 pt-2 pb-4" aria-label="Chat history">
						{isLoading ? (
							<div role="status" aria-live="polite" className="flex justify-center py-6">
								<LoadingIndicator label="Loading chats" />
							</div>
						) : loadError ? (
							<InlineStatus variant="error">{loadError}</InlineStatus>
						) : shownSessions.length === 0 ? (
							<NoResults>{emptyHistoryText}</NoResults>
						) : !selectMode && trimmedSearchQuery && (searchResults.length > 0 || isSearching || searchFailed) ? (
							<SearchResults
								results={searchResults}
								isSearching={isSearching}
								failed={searchFailed}
								onRetry={retrySearch}
								query={searchQuery}
								onMatchClick={(sessionId, messageId) => {
									closeSearch()
									onSearchMatchClick?.(sessionId, messageId)
								}}
								onSessionClick={(sessionId) => {
									// The results leave with the clicked one; the search toggle takes its focus, as clearing does.
									clearSearchField()
									onSessionSelect(sessionId)
								}}
							/>
						) : filteredSessions.length === 0 &&
						  trimmedSearchQuery &&
						  (selectMode || (!isSearching && searchResults.length === 0)) ? (
							<NoResults>No chats matching &ldquo;{searchQuery}&rdquo;</NoResults>
						) : (
							<div
								style={{
									height: `${totalSize}px`,
									width: '100%',
									position: 'relative'
								}}
							>
								{virtualizedItems.map((virtualItem) => {
									const item = virtualItems[virtualItem.index]
									const itemStyle: CSSProperties = {
										position: 'absolute',
										top: 0,
										left: 0,
										// Session rows extend into both 8px gutters, including when positioned by the virtualizer.
										width: item.type === 'session' ? 'calc(100% + 1rem)' : '100%',
										height: `${virtualItem.size}px`,
										transform: `translateY(${virtualItem.start - projectsSectionHeight}px)`
									}

									return (
										<VirtualizedSidebarItem
											key={
												item.type === 'header'
													? `header-${item.groupName}`
													: item.type === 'loader'
														? 'session-loader'
														: // The session alone: a row that remounts on new activity or a visibility change drops its open menu, rename or confirm.
															`session-${item.session.sessionId}`
											}
											item={item}
											itemStyle={itemStyle}
											currentSessionId={currentSessionId}
											restoringSessionId={restoringSessionId}
											onSessionSelect={onSessionSelect}
											onDelete={onDelete}
											selectMode={selectMode}
											isSelected={item.type === 'session' && selectedSessionIds.has(item.session.sessionId)}
											onToggleSelect={toggleSelect}
										/>
									)
								})}
							</div>
						)}
					</nav>
				</div>

				{confirmBulkDelete ? (
					<DeleteSessionDialog
						title={`Delete ${selectedIds.length} session${selectedIds.length === 1 ? '' : 's'}?`}
						errorMessage="Couldn't delete the selected chats."
						mutation={bulkDeletion}
						variables={selectedIds}
						onClose={() => setConfirmBulkDelete(false)}
						onSuccess={() => keepFocus(exitSelectMode, () => selectToggleRef.current)}
						finalFocus={bulkDeleteRef}
					/>
				) : null}
				{selectMode ? (
					<footer className="flex min-h-[52px] shrink-0 items-center gap-2 border-t border-subtle px-4 py-2">
						<Button
							type="button"
							size="md"
							variant="ghost"
							onClick={() => {
								if (allSelected) {
									setSelectedSessionIds(new Set())
								} else {
									setSelectedSessionIds(new Set(filteredSessions.map((s) => s.sessionId)))
								}
							}}
							className="flex-1"
						>
							{allSelected ? 'Deselect all' : 'Select all'}
						</Button>
						<Button
							type="button"
							size="md"
							variant="destructive"
							ref={bulkDeleteRef}
							onClick={() => setConfirmBulkDelete(true)}
							disabled={selectedIds.length === 0 || !onBulkDelete || bulkDeletion.isPending}
						>
							Delete{selectedIds.length > 0 ? ` (${selectedIds.length})` : ''}
						</Button>
					</footer>
				) : (
					<>
						<FreeUsageNote usage={freeUsage} showBonus className="shrink-0 border-t border-subtle px-4 py-2" />
						<footer className="flex min-h-[52px] shrink-0 items-stretch border-t border-subtle">
							{onOpenSettings ? (
								<button
									type="button"
									onClick={onOpenSettings}
									className="flex min-w-0 flex-1 items-center gap-1.5 rounded-bl-lg px-4 py-3 text-left body-sm text-secondary not-disabled:not-aria-disabled:hover:bg-hover-row not-disabled:not-aria-disabled:hover:text-primary"
								>
									<SettingsIcon hasCustomInstructions={hasCustomInstructions} />
									<span>Settings</span>
								</button>
							) : (
								<span className="flex-1" />
							)}
							{showBalance && onOpenBalanceSettings ? <SidebarBalance onOpen={onOpenBalanceSettings} /> : null}
							<Tooltip
								content="Get the mobile app · iOS & Android"
								render={<BasicLink href="/app" data-umami-event="mobile-app-chat-sidebar-click" />}
								className="flex shrink-0 items-center justify-center rounded-br-lg px-4 text-secondary not-disabled:not-aria-disabled:hover:bg-hover-row not-disabled:not-aria-disabled:hover:text-primary"
							>
								<Icon name="download" className="size-4" />
								<span className="sr-only">Get the mobile app</span>
							</Tooltip>
						</footer>
					</>
				)}
			</Card>
		</SessionListFocusContext.Provider>
	)
}

function SidebarBalance({ onOpen }: { onOpen: () => void }) {
	const { balance, totalAvailable } = useAiBalance()
	if (!balance) return null

	return (
		<Tooltip
			content="External Data Balance: credits that let LlamaAI access premium external data sources like onchain data, X profiles, LinkedIn, and more."
			render={<button type="button" onClick={onOpen} />}
			className={`flex shrink-0 items-center px-2 mono-sm-bold not-disabled:not-aria-disabled:hover:bg-hover-row ${totalAvailable < 1 ? 'text-warning' : 'text-primary'}`}
		>
			<span className="sr-only">External Data Balance</span>
			{formatUsd(totalAvailable, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
		</Tooltip>
	)
}

function SettingsIcon({ hasCustomInstructions }: { hasCustomInstructions?: boolean }) {
	return (
		<span className="relative flex">
			<Icon name="settings" className="size-4" />
			{hasCustomInstructions ? <span className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-brand" /> : null}
		</span>
	)
}

type SidebarPlace = 'chat' | 'terminal'

function SidebarItem({
	folded,
	label,
	tooltip,
	icon,
	trailing,
	active,
	onClick,
	...buttonProps
}: {
	ref?: Ref<HTMLButtonElement>
	folded: boolean
	label: string
	tooltip?: string
	icon: ReactNode
	trailing?: ReactNode
	active?: boolean
	onClick: () => void
	'aria-expanded'?: boolean
	'data-umami-event'?: string
	'data-umami-event-action'?: string
	'data-umami-event-source'?: string
	'data-walkthrough'?: string
}) {
	if (folded) {
		return (
			<Tooltip
				content={tooltip ?? label}
				placement="right"
				render={
					<Button
						type="button"
						size="md"
						variant="ghost"
						square
						data-active={active}
						onClick={onClick}
						{...buttonProps}
					/>
				}
			>
				{icon}
				<span className="sr-only">{label}</span>
			</Tooltip>
		)
	}
	return (
		<button
			type="button"
			data-active={active}
			onClick={onClick}
			className={`${SIDEBAR_ROW} w-full text-left`}
			{...buttonProps}
		>
			{icon}
			<span className="min-w-0 flex-1 truncate">{label}</span>
			{trailing}
		</button>
	)
}

function SidebarToggles({
	folded,
	searchOpen,
	onSearch,
	searchRef
}: {
	folded: boolean
	searchOpen: boolean
	onSearch: () => void
	searchRef?: Ref<HTMLButtonElement>
}) {
	const { toggleSidebar } = useLlamaAIChrome()
	return (
		<>
			<SidebarItem
				folded
				label={folded ? 'Open sidebar' : 'Close sidebar'}
				icon={<Icon name={folded ? 'panel-left-open' : 'panel-left-close'} className="size-4" />}
				onClick={toggleSidebar}
				aria-expanded={!folded}
				data-umami-event="llamaai-sidebar-toggle"
				data-umami-event-action={folded ? 'open' : 'close'}
				data-umami-event-source={folded ? 'sidebar_rail' : 'sidebar_header'}
			/>
			<SidebarItem
				ref={searchRef}
				folded
				label="Search chats"
				icon={<Icon name="search" className="size-4" />}
				active={searchOpen}
				onClick={onSearch}
				aria-expanded={searchOpen}
			/>
		</>
	)
}

function SidebarDestinations({
	folded,
	place,
	onNewChat,
	onSwitchPlace,
	newChatRef
}: {
	folded: boolean
	place: SidebarPlace
	onNewChat: () => void
	onSwitchPlace?: () => void
	newChatRef?: Ref<HTMLButtonElement>
}) {
	const terminalEnabled = useTerminalEnabled()
	const source = folded ? 'sidebar_rail' : 'sidebar'
	const newChat = () => {
		trackUmamiEvent('llamaai-new-chat')
		onNewChat()
	}
	// The place switch is a mode toggle: picking the place you are in does nothing.
	const switchPlace = (next: SidebarPlace) => {
		if (next === place) return
		trackUmamiEvent('llamaai-terminal-open', next === 'chat' ? { action: 'close', source } : { source })
		onSwitchPlace?.()
	}
	// The terminal never opens below lg, where the open sidebar has no second place to switch to; the rail is lg-only.
	const placeSwitch = terminalEnabled ? (
		<SegmentedControl
			label="View"
			variant="mode"
			size="md"
			value={place}
			onValueChange={switchPlace}
			options={
				folded
					? [
							{
								value: 'chat',
								label: <Icon name="message-square" className="size-4" />,
								ariaLabel: 'Chat',
								tooltip: 'Chat'
							},
							{
								value: 'terminal',
								label: <Icon name="bar-chart-2" className="size-4" />,
								ariaLabel: 'Terminal',
								tooltip: 'Terminal'
							}
						]
					: [
							{ value: 'chat', label: 'Chat' },
							{
								value: 'terminal',
								label: (
									<>
										Terminal
										<span className="rounded-full border border-ai-gold-muted bg-ai-gold-tint px-1.5 label-xs text-ai-gold-deep uppercase">
											New
										</span>
									</>
								)
							}
						]
			}
			className={folded ? undefined : 'grid-flow-col max-lg:hidden'}
		/>
	) : null
	if (folded) {
		return (
			<>
				<Tooltip
					content="New chat"
					placement="right"
					render={<Button type="button" size="md" variant="outline" square onClick={newChat} />}
				>
					<Icon name="square-pen" className="size-4" />
					<span className="sr-only">New chat</span>
				</Tooltip>
				{placeSwitch}
			</>
		)
	}
	return (
		<>
			{placeSwitch}
			<Button ref={newChatRef} type="button" size="md" variant="outline" onClick={newChat} className="w-full">
				<Icon name="square-pen" className="size-3.5" />
				New chat
			</Button>
		</>
	)
}

function AlertsItem({
	folded,
	alertsCount,
	onOpenAlerts
}: {
	folded: boolean
	alertsCount: number | null
	onOpenAlerts: () => void
}) {
	return (
		<SidebarItem
			folded={folded}
			label="Alerts"
			tooltip={typeof alertsCount === 'number' ? `Alerts (${alertsCount})` : 'Alerts'}
			data-walkthrough="alerts-item"
			icon={
				<span className="relative flex shrink-0">
					<Icon name="calendar-plus" className="size-4" />
					{folded && alertsCount ? (
						<span className="absolute -top-1.5 -right-2 min-w-3.5 rounded-full bg-surface-elevated-2 px-0.5 text-center label-xs text-secondary">
							{alertsCount}
						</span>
					) : null}
				</span>
			}
			trailing={
				typeof alertsCount === 'number' ? (
					<span className="shrink-0 body-sm text-tertiary tabular-nums">{alertsCount}</span>
				) : null
			}
			onClick={() => {
				trackUmamiEvent('llamaai-alerts-open', { source: folded ? 'sidebar_rail' : 'sidebar' })
				onOpenAlerts()
			}}
		/>
	)
}

function SidebarRail({
	place,
	onNewChat,
	onSwitchPlace,
	alertsCount,
	onOpenAlerts,
	onOpenSettings,
	hasCustomInstructions,
	onSearchOpenChange
}: Pick<
	AgenticSidebarProps,
	'onNewChat' | 'onSwitchPlace' | 'onOpenAlerts' | 'onOpenSettings' | 'hasCustomInstructions' | 'onSearchOpenChange'
> & { place: SidebarPlace; alertsCount: number | null }) {
	const { toggleSidebar } = useLlamaAIChrome()
	return (
		<nav
			aria-label="LlamaAI"
			className="mr-2 hidden w-11 flex-none flex-col items-center gap-1 rounded-lg border border-subtle bg-surface py-2 lg:flex"
		>
			<SidebarToggles
				folded
				searchOpen={false}
				onSearch={() => {
					onSearchOpenChange?.(true)
					toggleSidebar()
				}}
			/>
			<span aria-hidden="true" className="my-1 w-6 border-t border-subtle" />
			<SidebarDestinations folded place={place} onNewChat={onNewChat} onSwitchPlace={onSwitchPlace} />
			{onOpenAlerts ? <AlertsItem folded alertsCount={alertsCount} onOpenAlerts={onOpenAlerts} /> : null}
			<SidebarItem
				folded
				label="Projects"
				icon={<Icon name="folder" className="size-4" />}
				onClick={() => {
					setStorageItem(SIDEBAR_PROJECTS_OPEN_KEY, 'true')
					toggleSidebar()
				}}
			/>
			{onOpenSettings ? (
				<div className="mt-auto flex">
					<SidebarItem
						folded
						label="Settings"
						icon={<SettingsIcon hasCustomInstructions={hasCustomInstructions} />}
						onClick={onOpenSettings}
					/>
				</div>
			) : null}
		</nav>
	)
}
