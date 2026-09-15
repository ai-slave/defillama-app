import * as Ariakit from '@ariakit/react'
import { useMutation } from '@tanstack/react-query'
import type { Virtualizer } from '@tanstack/react-virtual'
import { type CSSProperties, memo, useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { BasicLink } from '~/components/Link'
import { useLlamaAIChrome } from '~/containers/LlamaAI/chrome'
import { DeleteSessionDialog, SessionListFocusContext } from '~/containers/LlamaAI/components/DeleteSessionDialog'
import { AgenticSessionItem } from '~/containers/LlamaAI/components/sidebar/AgenticSessionItem'
import { SearchResults } from '~/containers/LlamaAI/components/sidebar/SearchResults'
import { useSemanticSearch } from '~/containers/LlamaAI/hooks/useSemanticSearch'
import { ProjectsSidebarSection } from '~/containers/LlamaAI/projects/ProjectsSidebarSection'
import type { ChatSession } from '~/containers/LlamaAI/types'
import { compareSessionsByActivity } from '~/containers/LlamaAI/utils/sessionActivityOrder'
import { useAiBalance } from '~/containers/Subscription/useTopup'
import { useStableCallback } from '~/hooks/useStableCallback'
import { useVirtualItems } from '~/hooks/useVirtualItems'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { Input, searchFieldIconStyles, searchFieldInputPlacementStyles } from '~/ui/Input'
import { LoadingSpinner } from '~/ui/Loaders'
import { InlineStatus } from '~/ui/Status'
import { Tooltip } from '~/ui/Tooltip'
import { trackUmamiEvent } from '~/utils/analytics/umami'
import { formatUsd } from '~/utils/numberFormat'

/* One row recipe for every sidebar list item: 32px, body-sm, hover wash, brand tint when active. */
export const SIDEBAR_ROW_SURFACE =
	'flex items-center gap-1.5 rounded-md body-sm text-primary not-disabled:not-aria-disabled:hover:bg-hover-row focus-within:bg-hover-row data-[active=true]:bg-brand-muted data-[active=true]:text-link-on-tint'
export const SIDEBAR_ROW = `${SIDEBAR_ROW_SURFACE} px-2 py-1.5`
export const SIDEBAR_WELL =
	'flex items-center justify-center rounded-lg border border-dashed border-medium p-4 text-center body-sm text-tertiary'

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
				{item.groupName === 'Pinned' ? <Icon name="pin" height={14} width={14} className="shrink-0" /> : null}
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

export function AgenticSidebar({
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
	alertsCount = null,
	onOpenAlerts
}: AgenticSidebarProps) {
	const { hideSidebar, isFullscreen, toggleFullscreen, toggleSidebar } = useLlamaAIChrome()
	const newChatRef = useRef<HTMLButtonElement>(null)
	const sidebarRef = useRef<HTMLDivElement>(null)
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

	const deleteStore = Ariakit.useDialogStore()
	const bulkDeleteRef = useRef<HTMLButtonElement>(null)
	const bulkDeletion = useMutation({
		mutationFn: (ids: Array<string>) => onBulkDelete!(ids),
		onError: (error) => {
			if (!deleteStore.getState().contentElement?.isConnected) toast.error(error.message)
		}
	})

	const exitSelectMode = useCallback(() => {
		setSelectMode(false)
		setSelectedSessionIds(new Set())
	}, [])

	const [nowMs] = useState(() => Date.now())
	const trimmedSearchQuery = searchQuery.trim()

	const nonProjectSessions = useMemo(() => sessions.filter((s) => !s.projectId), [sessions])
	const hasNonProjectSessions = nonProjectSessions.length > 0

	const filteredSessions = useMemo(() => {
		if (!trimmedSearchQuery) return nonProjectSessions
		return nonProjectSessions.filter((s) => s.title.toLowerCase().includes(trimmedSearchQuery.toLowerCase()))
	}, [nonProjectSessions, trimmedSearchQuery])

	const selectedIds = useMemo(() => {
		const ids: Array<string> = []
		for (const session of filteredSessions) {
			if (selectedSessionIds.has(session.sessionId)) ids.push(session.sessionId)
		}
		return ids
	}, [filteredSessions, selectedSessionIds])
	const handleBulkDelete = () => {
		if (selectedIds.length === 0 || !onBulkDelete || bulkDeletion.isPending) return
		bulkDeletion.mutate(selectedIds, {
			onSuccess: () => {
				deleteStore.hide()
				setSelectMode(false)
				setSelectedSessionIds(new Set())
			}
		})
	}

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
		if (
			event.target instanceof Node &&
			sidebarRef.current &&
			!sidebarRef.current.contains(event.target) &&
			!(event.target instanceof Element && event.target.closest('[role="dialog"], [role="menu"]')) &&
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
			<aside
				ref={sidebarRef}
				className={`llamaai-agentic-sidebar relative flex size-full max-w-[272px] flex-col rounded-lg border border-subtle bg-surface max-lg:absolute max-lg:top-0 max-lg:right-0 max-lg:bottom-0 max-lg:left-0 max-lg:z-10 lg:mr-2 ${shouldAnimate ? 'motion-safe:animate-[slideInRight_0.15s_ease-out]' : ''}`}
			>
				<header className="flex flex-col gap-2 p-4 pb-2">
					<div className="flex min-h-6 items-center">
						{isLoading || hasNonProjectSessions ? (
							<Button
								type="button"
								size="sm"
								variant="ghost"
								data-active={selectMode}
								onClick={selectMode ? exitSelectMode : () => setSelectMode(true)}
								disabled={isLoading && !hasNonProjectSessions}
								className="-ml-2 disabled:invisible"
							>
								<Icon name={selectMode ? 'x' : 'check'} height={14} width={14} />
								{selectMode ? 'Cancel' : 'Select'}
							</Button>
						) : null}
						<div className="ml-auto flex items-center gap-1.5">
							<Tooltip
								content={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
								render={
									<Button
										type="button"
										size="sm"
										variant="outline"
										square
										onClick={toggleFullscreen}
										data-umami-event="llamaai-fullscreen-toggle"
										data-umami-event-action={isFullscreen ? 'exit' : 'enter'}
										data-umami-event-source="sidebar_header"
										className="max-lg:hidden"
									/>
								}
							>
								<Icon name={isFullscreen ? 'shrink' : 'expand'} height={16} width={16} />
								<span className="sr-only">{isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}</span>
							</Tooltip>

							<Tooltip
								content="Close Chat History"
								render={
									<Button
										type="button"
										size="sm"
										variant="outline"
										square
										onClick={toggleSidebar}
										data-umami-event="llamaai-sidebar-toggle"
										data-umami-event-action="close"
										data-umami-event-source="sidebar_header"
									/>
								}
							>
								<Icon name="panel-left-close" height={16} width={16} />
								<span className="sr-only">Close Chat History</span>
							</Tooltip>
						</div>
					</div>

					<Button
						ref={newChatRef}
						type="button"
						size="md"
						variant="outline"
						onClick={() => {
							trackUmamiEvent('llamaai-new-chat')
							onNewChat()
						}}
						className="w-full"
					>
						<Icon name="square-pen" height={14} width={14} />
						New Chat
					</Button>

					{isLoading || hasNonProjectSessions ? (
						<div className="relative w-full min-w-0">
							<Icon name="search" height={16} width={16} className={searchFieldIconStyles} />
							<Input
								type="text"
								value={searchQuery}
								onChange={(e) => {
									setSearchQuery(e.target.value)
									setSelectedSessionIds(new Set())
								}}
								aria-label="Search sessions"
								placeholder="Search"
								disabled={isLoading && !hasNonProjectSessions}
								className={`${searchFieldInputPlacementStyles} ${searchQuery || isSearching ? 'pr-9' : ''}`}
							/>
							<span className="absolute top-0 right-1 bottom-0 my-auto flex items-center gap-1">
								{isSearching ? (
									<span role="status" className="flex size-6 items-center justify-center text-tertiary">
										<LoadingSpinner size={12} />
										<span className="sr-only">Searching</span>
									</span>
								) : searchQuery ? (
									<Button
										type="button"
										variant="ghost"
										size="sm"
										square
										aria-label="Clear session search"
										onClick={() => {
											clearSearch()
											setSelectedSessionIds(new Set())
										}}
									>
										<Icon name="x" height={14} width={14} />
									</Button>
								) : null}
							</span>
						</div>
					) : null}
				</header>

				<div
					ref={scrollContainerRef}
					className="flex-1 [scrollbar-width:thin] [scrollbar-gutter:stable] overflow-auto overscroll-contain"
				>
					<div ref={projectsSectionRef} className="border-b border-subtle pb-3">
						<ProjectsSidebarSection
							sessions={sessions}
							currentProjectId={currentProjectId}
							currentSessionProjectId={currentSessionProjectId}
							currentSessionId={currentSessionId}
							restoringSessionId={restoringSessionId}
							onSessionSelect={onSessionSelect}
							onDelete={onDelete}
						/>
						{onOpenAlerts ? (
							<div className="px-4 pt-1">
								<button
									type="button"
									onClick={() => {
										trackUmamiEvent('llamaai-alerts-open', { source: 'sidebar' })
										onOpenAlerts()
									}}
									className={`${SIDEBAR_ROW} -mx-2 w-[calc(100%+1rem)] text-left`}
								>
									<Icon name="calendar-plus" height={16} width={16} className="shrink-0 text-warning" />
									<span className="min-w-0 flex-1 truncate">Alerts</span>
									{typeof alertsCount === 'number' ? (
										<span className="shrink-0 body-sm text-tertiary tabular-nums">{alertsCount}</span>
									) : null}
								</button>
							</div>
						) : null}
					</div>

					<nav className="px-4 pt-3 pb-4" aria-label="Chat history">
						{isLoading ? (
							<div role="status" aria-live="polite" className={SIDEBAR_WELL}>
								<LoadingSpinner size={14} />
								<span className="sr-only">Loading chats</span>
							</div>
						) : loadError ? (
							<InlineStatus variant="error">{loadError}</InlineStatus>
						) : nonProjectSessions.length === 0 ? (
							<p className={SIDEBAR_WELL}>You don&apos;t have any chats yet</p>
						) : !selectMode && trimmedSearchQuery && (searchResults.length > 0 || isSearching || searchFailed) ? (
							<SearchResults
								results={searchResults}
								isSearching={isSearching}
								failed={searchFailed}
								onRetry={retrySearch}
								query={searchQuery}
								onMatchClick={(sessionId, messageId) => {
									clearSearch()
									onSearchMatchClick?.(sessionId, messageId)
								}}
								onSessionClick={(sessionId) => {
									clearSearch()
									onSessionSelect(sessionId)
								}}
							/>
						) : filteredSessions.length === 0 &&
						  trimmedSearchQuery &&
						  (selectMode || (!isSearching && searchResults.length === 0)) ? (
							<p className={SIDEBAR_WELL}>No chats matching &ldquo;{searchQuery}&rdquo;</p>
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
														: `session-${item.session.sessionId}-${item.session.isPublic}-${item.session.lastActivity}`
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

				{showBalance && onOpenBalanceSettings ? <SidebarBalance onOpen={onOpenBalanceSettings} /> : null}

				<DeleteSessionDialog
					store={deleteStore}
					title={`Delete ${selectedIds.length} session${selectedIds.length === 1 ? '' : 's'}?`}
					pending={bulkDeletion.isPending}
					error={bulkDeletion.error}
					onConfirm={handleBulkDelete}
					finalFocus={bulkDeleteRef}
				/>
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
							{allSelected ? 'Deselect All' : 'Select All'}
						</Button>
						<Button
							type="button"
							size="md"
							variant="destructive"
							ref={bulkDeleteRef}
							onClick={() => {
								bulkDeletion.reset()
								deleteStore.show()
							}}
							disabled={selectedIds.length === 0 || !onBulkDelete || bulkDeletion.isPending}
						>
							Delete{selectedIds.length > 0 ? ` (${selectedIds.length})` : ''}
						</Button>
					</footer>
				) : (
					<footer className="flex min-h-[52px] shrink-0 items-stretch border-t border-subtle">
						{onOpenSettings ? (
							<button
								type="button"
								onClick={onOpenSettings}
								className="flex min-w-0 flex-1 items-center gap-1.5 rounded-bl-lg px-4 py-3 text-left body-sm text-secondary not-disabled:not-aria-disabled:hover:bg-hover-row not-disabled:not-aria-disabled:hover:text-primary"
							>
								<div className="relative">
									<Icon name="settings" height={16} width={16} />
									{hasCustomInstructions ? (
										<span className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-brand" />
									) : null}
								</div>
								<span>Settings</span>
							</button>
						) : (
							<span className="flex-1" />
						)}
						<Tooltip
							content="Get the mobile app · iOS & Android"
							render={<BasicLink href="/app" data-umami-event="mobile-app-chat-sidebar-click" />}
							className="flex shrink-0 items-center justify-center rounded-br-lg px-4 text-secondary not-disabled:not-aria-disabled:hover:bg-hover-row not-disabled:not-aria-disabled:hover:text-primary"
						>
							<Icon name="download" height={16} width={16} />
							<span className="sr-only">Get the mobile app</span>
						</Tooltip>
					</footer>
				)}
			</aside>
		</SessionListFocusContext.Provider>
	)
}

function SidebarBalance({ onOpen }: { onOpen: () => void }) {
	const { balance, totalAvailable } = useAiBalance()
	if (!balance) return null

	return (
		<Tooltip
			content="Credits that let LlamaAI access premium external data sources like onchain data, X profiles, LinkedIn, and more."
			render={<button type="button" onClick={onOpen} />}
			className="flex min-h-[52px] w-full shrink-0 items-center justify-between truncate border-t border-subtle bg-surface px-4 py-3 body-sm text-secondary not-disabled:not-aria-disabled:hover:bg-hover-row not-disabled:not-aria-disabled:hover:text-primary"
		>
			<div className="flex min-w-0 items-center gap-1.5">
				<Icon name="wallet" height={16} width={16} className="shrink-0 text-ai-research" />
				<span>External Data Balance</span>
			</div>
			<span className={`shrink-0 mono-sm-bold ${totalAvailable < 1 ? 'text-warning' : 'text-primary'}`}>
				{formatUsd(totalAvailable, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
			</span>
		</Tooltip>
	)
}
