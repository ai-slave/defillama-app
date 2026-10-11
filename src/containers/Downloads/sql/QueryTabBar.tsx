import * as Ariakit from '@ariakit/react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { Input } from '~/ui/Input'
import { LoadingSpinner } from '~/ui/Loaders'
import { MenuItem, MenuSurface } from '~/ui/MenuSurface'
import { StatusDot } from '~/ui/StatusBadge'
import { Tab, tabIds } from '~/ui/Tabs'
import { Tooltip } from '~/ui/Tooltip'
import type { QueryTab } from './useSqlTabs'

interface QueryTabBarProps {
	tabs: Array<QueryTab>
	activeTabId: string
	onClose: (id: string) => void
	onNewTab: () => void
	onNewNotebookTab: () => void
	onRename: (id: string, title: string) => void
	onDuplicate: (id: string) => void
	onCloseOthers: (id: string) => void
	onCloseToRight: (id: string) => void
	onConvertToNotebook?: (id: string) => void
}

interface ContextMenuState {
	trigger: HTMLElement
	id: string
	anchor: { x: number; y: number } | null
}

export function QueryTabBar({
	tabs,
	activeTabId,
	onClose,
	onNewTab,
	onNewNotebookTab,
	onRename,
	onDuplicate,
	onCloseOthers,
	onCloseToRight,
	onConvertToNotebook
}: QueryTabBarProps) {
	const tabStore = Ariakit.useTabContext()!
	const prefix = Ariakit.useStoreState(tabStore, 'id')
	// Only explicit tab actions request focus; background query updates must not steal it.
	const pendingFocus = useRef<string | null>(null)
	const scrollerRef = useRef<HTMLDivElement | null>(null)
	const [renamingId, setRenamingId] = useState<string | null>(null)
	const [menu, setMenu] = useState<ContextMenuState | null>(null)
	const menuStore = Ariakit.useMenuStore()
	const menuOpen = Ariakit.useStoreState(menuStore, 'open')
	useLayoutEffect(() => {
		if (pendingFocus.current === null) return
		const id = pendingFocus.current === 'selected' ? activeTabId : pendingFocus.current
		pendingFocus.current = null
		document.getElementById(tabIds(prefix, id).tabId)?.focus()
	})

	const [showLeftFade, setShowLeftFade] = useState(false)
	const [showRightFade, setShowRightFade] = useState(false)

	const updateFades = useCallback(() => {
		const el = scrollerRef.current
		if (!el) return
		setShowLeftFade(el.scrollLeft > 2)
		setShowRightFade(el.scrollLeft + el.clientWidth < el.scrollWidth - 2)
	}, [])

	useEffect(() => {
		updateFades()
		const el = scrollerRef.current
		if (!el) return
		const onScroll = () => updateFades()
		el.addEventListener('scroll', onScroll, { passive: true })
		const ro = new ResizeObserver(updateFades)
		ro.observe(el)
		return () => {
			el.removeEventListener('scroll', onScroll)
			ro.disconnect()
		}
	}, [updateFades])

	const handleContextMenu = (e: React.MouseEvent<HTMLButtonElement>, id: string) => {
		e.preventDefault()
		menuStore.setAutoFocusOnShow(true)
		menuStore.setInitialFocus('first')
		menuStore.setDisclosureElement(e.currentTarget)
		setMenu({ id, trigger: e.currentTarget, anchor: { x: e.clientX, y: e.clientY } })
		menuStore.show()
	}

	const canClose = tabs.length > 1
	const menuTab = menu ? tabs.find((t) => t.id === menu.id) : null
	const menuAnchor = menu?.anchor
	const menuIndex = menu ? tabs.findIndex((t) => t.id === menu.id) : -1

	return (
		<div className="relative flex items-end border-b border-subtle">
			<Ariakit.TabList
				aria-label="SQL query tabs"
				ref={scrollerRef}
				className="flex min-w-0 items-end gap-0.5 overflow-x-auto overflow-y-hidden"
				style={{
					scrollbarWidth: 'thin',
					maskImage:
						showLeftFade && showRightFade
							? 'linear-gradient(90deg, transparent 0, black 24px, black calc(100% - 24px), transparent 100%)'
							: showLeftFade
								? 'linear-gradient(90deg, transparent 0, black 24px, black 100%)'
								: showRightFade
									? 'linear-gradient(90deg, black 0, black calc(100% - 24px), transparent 100%)'
									: undefined
				}}
			>
				{tabs.map((tab) => {
					const active = tab.id === activeTabId
					const isRenaming = renamingId === tab.id
					return (
						<TabPill
							key={tab.id}
							tab={tab}
							active={active}
							canClose={canClose}
							isRenaming={isRenaming}
							onClose={(restoreFocus) => {
								pendingFocus.current = restoreFocus ? 'selected' : null
								onClose(tab.id)
							}}
							onStartRename={() => setRenamingId(tab.id)}
							onFinishRename={(title, restoreFocus) => {
								pendingFocus.current = restoreFocus ? tab.id : null
								onRename(tab.id, title)
								setRenamingId(null)
							}}
							onCancelRename={() => {
								pendingFocus.current = tab.id
								setRenamingId(null)
							}}
							menuStore={menuStore}
							menuOpen={menuOpen && menu?.id === tab.id}
							onOpenMenu={(trigger) => setMenu({ id: tab.id, trigger, anchor: null })}
							onContextMenu={(e) => handleContextMenu(e, tab.id)}
						/>
					)
				})}
			</Ariakit.TabList>
			<NewTabMenu
				onNewTab={() => {
					pendingFocus.current = 'selected'
					onNewTab()
				}}
				onNewNotebook={() => {
					pendingFocus.current = 'selected'
					onNewNotebookTab()
				}}
			/>

			{menu && menuTab ? (
				<MenuSurface
					variant="actions"
					store={menuStore}
					aria-label={`Actions for ${menuTab.title}`}
					finalFocus={menu.trigger}
					getAnchorRect={
						menuAnchor
							? () => ({
									x: menuAnchor.x,
									y: menuAnchor.y,
									width: 0,
									height: 0,
									top: menuAnchor.y,
									left: menuAnchor.x,
									right: menuAnchor.x,
									bottom: menuAnchor.y
								})
							: undefined
					}
					gutter={2}
					className="min-w-[200px]"
				>
					<MenuItem
						onClick={() => {
							setRenamingId(menu.id)
							menuStore.hide()
						}}
					>
						<Icon name="pencil" className="size-3.5 shrink-0 text-tertiary" />
						Rename
					</MenuItem>
					<MenuItem
						onClick={() => {
							pendingFocus.current = 'selected'
							onDuplicate(menu.id)
							menuStore.hide()
						}}
					>
						<Icon name="copy" className="size-3.5 shrink-0 text-tertiary" />
						Duplicate
					</MenuItem>
					{menuTab.mode === 'query' && onConvertToNotebook ? (
						<MenuItem
							onClick={() => {
								pendingFocus.current = menu.id
								onConvertToNotebook(menu.id)
								menuStore.hide()
							}}
						>
							<Icon name="layers" className="size-3.5 shrink-0 text-tertiary" />
							Convert to notebook
						</MenuItem>
					) : null}
					<MenuItem
						disabled={!canClose}
						onClick={() => {
							pendingFocus.current = 'selected'
							onClose(menu.id)
							menuStore.hide()
						}}
						className="border-t border-subtle"
					>
						<Icon name="x" className="size-3.5 shrink-0 text-tertiary" />
						Close
					</MenuItem>
					<MenuItem
						disabled={tabs.length <= 1}
						onClick={() => {
							pendingFocus.current = 'selected'
							onCloseOthers(menu.id)
							menuStore.hide()
						}}
					>
						<Icon name="x" className="size-3.5 shrink-0 text-tertiary" />
						Close others
					</MenuItem>
					<MenuItem
						disabled={menuIndex === -1 || menuIndex >= tabs.length - 1}
						onClick={() => {
							pendingFocus.current = menu.id
							onCloseToRight(menu.id)
							menuStore.hide()
						}}
					>
						<Icon name="arrow-right" className="size-3.5 shrink-0 text-tertiary" />
						Close tabs to the right
					</MenuItem>
				</MenuSurface>
			) : null}
		</div>
	)
}

function NewTabMenu({ onNewTab, onNewNotebook }: { onNewTab: () => void; onNewNotebook: () => void }) {
	return (
		<Ariakit.MenuProvider>
			<Tooltip
				content="New tab (⌘T)"
				render={
					<Ariakit.MenuButton
						aria-label="New tab"
						render={<Button variant="ghost" size="md" square className="mb-px ml-0.5 shrink-0 self-start" />}
					/>
				}
			>
				<Icon name="plus" className="size-4" />
			</Tooltip>
			<MenuSurface variant="actions" gutter={4}>
				<MenuItem onClick={onNewTab}>
					<Icon name="file-text" className="size-3.5 shrink-0 text-tertiary" />
					<span className="flex-1">New query tab</span>
					<span className="mono-sm text-tertiary">⌘T</span>
				</MenuItem>
				<MenuItem onClick={onNewNotebook}>
					<Icon name="layers" className="size-3.5 shrink-0 text-tertiary" />
					<span className="flex-1">New notebook tab</span>
				</MenuItem>
			</MenuSurface>
		</Ariakit.MenuProvider>
	)
}

interface TabPillProps {
	tab: QueryTab
	active: boolean
	canClose: boolean
	isRenaming: boolean
	onClose: (restoreFocus: boolean) => void
	onStartRename: () => void
	onFinishRename: (title: string, restoreFocus: boolean) => void
	onCancelRename: () => void
	onContextMenu: (e: React.MouseEvent<HTMLButtonElement>) => void
	onOpenMenu: (trigger: HTMLElement) => void
	menuOpen: boolean
	menuStore: Ariakit.MenuStore
}

function TabPill({
	tab,
	active,
	canClose,
	isRenaming,
	onClose,
	onStartRename,
	onFinishRename,
	onCancelRename,
	onContextMenu,
	onOpenMenu,
	menuStore,
	menuOpen
}: TabPillProps) {
	const store = Ariakit.useTabContext()!
	const prefix = Ariakit.useStoreState(store, 'id')
	const focused = Ariakit.useStoreState(store, (state) => state.activeId === tabIds(prefix, tab.id).tabId)
	const isNotebook = tab.mode === 'notebook'
	const running = tab.running || (tab.cells?.some((c) => c.running) ?? false)
	const dirty = tab.dirty || (tab.cells?.some((c) => c.dirty) ?? false)
	return (
		<div
			ref={active ? scrollIntoViewNearest : undefined}
			data-active={active}
			className={`group relative flex h-8 max-w-[240px] min-w-[120px] shrink-0 items-center rounded-t-md border-x border-t pr-1.5 body-md transition-colors before:pointer-events-none before:absolute before:top-1/2 before:-left-px before:h-4 before:w-px before:-translate-y-1/2 before:bg-border-subtle first:before:hidden hover:before:hidden data-[active=true]:before:hidden [[data-active=true]+&]:before:hidden ${active ? 'border-subtle bg-page text-primary' : 'border-transparent bg-transparent text-secondary hover:bg-hover-row hover:text-primary'}`}
		>
			<Tab
				value={tab.id}
				type="button"
				aria-label={isNotebook ? `Notebook: ${tab.title}` : tab.title}
				title={isNotebook ? `Notebook · ${tab.title}` : tab.title}
				onFocus={(event) => event.currentTarget.parentElement?.scrollIntoView({ block: 'nearest', inline: 'nearest' })}
				onDoubleClick={onStartRename}
				onContextMenu={onContextMenu}
				onMouseDown={(event) => {
					if (event.button === 1 && canClose) {
						event.preventDefault()
						onClose(event.currentTarget === document.activeElement)
					}
				}}
				onKeyDown={(event) => {
					if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
						event.preventDefault()
						menuStore.setAutoFocusOnShow(true)
						menuStore.setInitialFocus('first')
						menuStore.setDisclosureElement(event.currentTarget)
						menuStore.setAnchorElement(event.currentTarget)
						onOpenMenu(event.currentTarget)
						menuStore.show()
					}
				}}
				className="flex h-full min-w-0 flex-1 items-center gap-1.5 rounded-tl-md px-2.5 text-left font-medium"
			>
				<span className="flex size-3 shrink-0 items-center justify-center">
					{running ? (
						<span aria-hidden className="flex">
							<LoadingSpinner size={10} />
						</span>
					) : dirty ? (
						<StatusDot status="caution" label="Unsaved changes" />
					) : null}
				</span>
				{isNotebook ? (
					<Icon
						name="layers"
						aria-hidden
						className={`size-3 shrink-0 ${active ? 'text-secondary' : 'text-tertiary'}`}
					/>
				) : null}
				<span className={`min-w-0 flex-1 truncate ${isRenaming ? 'invisible' : ''}`}>{tab.title}</span>
			</Tab>
			{isRenaming ? <RenameInput initial={tab.title} onCommit={onFinishRename} onCancel={onCancelRename} /> : null}
			<Ariakit.MenuButton
				store={menuStore}
				aria-label={`Actions for ${tab.title}`}
				tabIndex={focused ? 0 : -1}
				onClick={(event) => onOpenMenu(event.currentTarget)}
				aria-expanded={menuOpen}
				onKeyDown={(event) => {
					if (event.key === 'ArrowDown' || event.key === 'ArrowUp') onOpenMenu(event.currentTarget)
				}}
				className="flex size-5 shrink-0 items-center justify-center rounded-sm text-tertiary hover:bg-hover-row hover:text-primary"
			>
				<Icon name="ellipsis" className="size-3" />
			</Ariakit.MenuButton>
			{canClose ? (
				<button
					type="button"
					tabIndex={focused ? 0 : -1}
					aria-label={`Close ${tab.title}`}
					onClick={() => onClose(true)}
					className={`flex size-5 shrink-0 items-center justify-center rounded-sm text-tertiary transition-opacity hover:bg-hover-row hover:text-primary ${active ? 'opacity-60 hover:opacity-100' : 'opacity-0 group-focus-within:opacity-60 group-hover:opacity-60 hover:opacity-100!'}`}
				>
					<Icon name="x" className="size-3" />
				</button>
			) : null}
			{active ? <span aria-hidden className="absolute inset-x-0 -bottom-px h-px bg-page" /> : null}
		</div>
	)
}

// Module scope keeps each ref callback's identity stable, so it runs when its element attaches, not on every render.
function scrollIntoViewNearest(pill: HTMLDivElement | null) {
	pill?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
}

function focusAndSelect(input: HTMLInputElement | null) {
	input?.focus()
	input?.select()
}

function RenameInput({
	initial,
	onCommit,
	onCancel
}: {
	initial: string
	onCommit: (title: string, restoreFocus: boolean) => void
	onCancel: () => void
}) {
	const [value, setValue] = useState(initial)
	// Enter/Escape may also cause blur when focus returns to the tab.
	const finished = useRef(false)
	return (
		<Input
			variant="inline"
			ref={focusAndSelect}
			aria-label={`Rename ${initial}`}
			value={value}
			onChange={(event) => setValue(event.target.value)}
			onKeyDown={(event) => {
				event.stopPropagation()
				if (event.nativeEvent.isComposing) return
				if (event.key === 'Enter' || event.key === 'Escape') {
					event.preventDefault()
					finished.current = true
					if (event.key === 'Enter') onCommit(value, true)
					else onCancel()
				}
			}}
			onBlur={() => {
				if (!finished.current) {
					finished.current = true
					onCommit(value, false)
				}
			}}
			className="absolute inset-y-1 right-12 left-2"
		/>
	)
}
