import * as Ariakit from '@ariakit/react'
import { type KeyboardEvent, type MouseEvent, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '~/ui/Button'
import { Dialog, DialogBody, DialogFooter, DialogSearchHeader } from '~/ui/Dialog'
import { Icon, type IIcon } from '~/ui/Icon'
import { inputStyles } from '~/ui/Input'
import { LoadingIndicator } from '~/ui/Status'
import { Tag } from '~/ui/Tag'
import { tw } from '~/ui/tw'
import { useAppMetadata } from '../AppMetadataContext'
import type { DashboardItemConfig } from '../dashboardItemConfig'
import { requestDashboardItemReveal } from '../hooks/useDashboardItemDeepLink'
import {
	useProDashboardCatalog,
	useProDashboardEditorActions,
	useProDashboardItemsState
} from '../ProDashboardAPIContext'
import { buildQuickAddIndex } from '../quickAdd/quickAddIndex'
import { parseQuickAddQuery } from '../quickAdd/quickAddQuery'
import { pushQuickAddRecent, type QuickAddRecent, readQuickAddRecents } from '../quickAdd/quickAddRecents'
import {
	type QuickAddAvailability,
	buildLeadingQuickAddSuggestion,
	buildQuickAddSuggestions,
	isQuickAddQueryEmpty,
	type QuickAddSuggestion,
	type QuickAddSuggestionGroup,
	type QuickAddSuggestionKind
} from '../quickAdd/quickAddSuggestions'
import type { DashboardItemPlacement } from '../useDashboardActions'
import { TOAST_DURATION_SHORT } from './dashboardToasts'
import { EntityIcon } from './EntityIcon'

const KIND_LABELS: Record<QuickAddSuggestionKind, string> = {
	chart: 'Chart',
	metric: 'Metric',
	multi: 'Compare',
	table: 'Table',
	text: 'Text',
	section: 'Section',
	'open-editor': 'Editor'
}

const KIND_ICONS: Record<QuickAddSuggestionKind, IIcon['name']> = {
	chart: 'bar-chart-2',
	metric: 'activity',
	multi: 'bar-chart-2',
	table: 'layout-grid',
	text: 'plus',
	section: 'layout-grid',
	'open-editor': 'sparkles'
}

const GROUP_LABELS: Record<QuickAddSuggestionGroup, string> = {
	suggested: 'Suggested for this dashboard',
	recent: 'Recent',
	start: 'Start with'
}

const GROUP_ORDER: ReadonlyArray<QuickAddSuggestionGroup> = ['suggested', 'recent', 'start']

const QUICK_ADD_PLACEHOLDER = 'Search charts, protocols, chains…'

const KBD_STYLES = tw`rounded-sm border border-medium px-1 body-sm text-secondary`

const ROW_STYLES = tw`group flex w-full cursor-pointer scroll-my-1 items-center gap-3 rounded-md px-2 py-2 text-left data-active-item:bg-hover-row`

function rowElementId(index: number): string {
	return `quick-add-row-${index}`
}

function suggestionDraftItem(suggestion: QuickAddSuggestion): DashboardItemConfig | null {
	if (suggestion.entity === undefined) return null
	if (suggestion.kind !== 'chart' && suggestion.kind !== 'metric') return null
	const [draft] = suggestion.build([])
	return draft ?? null
}

function suggestionRecent(suggestion: QuickAddSuggestion): QuickAddRecent | null {
	const entity = suggestion.entity
	if (entity === undefined || suggestion.kind === 'open-editor' || suggestion.kind === 'multi') return null
	return {
		subjectType: entity.subjectType,
		id: entity.id,
		name: entity.name,
		kind: suggestion.kind,
		...(suggestion.metric === undefined ? {} : { metric: suggestion.metric })
	}
}

interface QuickAddRowProps {
	suggestion: QuickAddSuggestion
	index: number
	onSelect: (suggestion: QuickAddSuggestion, closeAfter: boolean) => void
	onCustomize: (suggestion: QuickAddSuggestion) => void
}

function QuickAddRow({ suggestion, index, onSelect, onCustomize }: QuickAddRowProps) {
	const entity = suggestion.entity
	const customizable = suggestionDraftItem(suggestion) !== null
	return (
		<Ariakit.ComboboxItem
			id={rowElementId(index)}
			value={suggestion.id}
			setValueOnClick={false}
			hideOnClick={false}
			focusOnHover
			className={ROW_STYLES}
			data-umami-event={suggestion.kind === 'open-editor' ? 'dashboard-quick-add-open-editor' : 'dashboard-quick-add'}
			data-umami-event-kind={suggestion.kind}
			onClick={() => onSelect(suggestion, false)}
		>
			{entity ? (
				<EntityIcon src={entity.logo} name={entity.name} />
			) : (
				<span className="inline-flex size-5 shrink-0 items-center justify-center text-tertiary">
					<Icon name={KIND_ICONS[suggestion.kind]} height={14} width={14} />
				</span>
			)}
			<span className="flex min-w-0 flex-1 flex-col">
				<span className="truncate body-md text-primary">{suggestion.title}</span>
				<span className="truncate body-sm text-tertiary">
					{suggestion.alreadyOnDashboard ? 'Already on dashboard' : suggestion.detail}
				</span>
			</span>
			{customizable ? (
				// A span, not a button: the row is the option, and keyboard users reach Customize with Tab.
				<Button
					as="span"
					variant="ghost"
					size="sm"
					aria-hidden="true"
					className="invisible max-md:hidden md:group-hover:visible md:group-data-active-item:visible"
					onClick={(event: MouseEvent<HTMLSpanElement>) => {
						event.stopPropagation()
						onCustomize(suggestion)
					}}
				>
					Customize
					<kbd className={KBD_STYLES}>Tab</kbd>
				</Button>
			) : null}
			<Tag className="max-sm:hidden">{KIND_LABELS[suggestion.kind]}</Tag>
			<kbd className={`hidden ${KBD_STYLES} md:group-data-active-item:inline`}>↵</kbd>
		</Ariakit.ComboboxItem>
	)
}

export interface QuickAddPaletteProps {
	open: boolean
	onClose: () => void
	onClosed?: () => void
	placement?: DashboardItemPlacement
	onOpenFullEditor: (options: { placement?: DashboardItemPlacement; draftItem?: DashboardItemConfig }) => void
}

export function QuickAddPalette({ open, onClose, onClosed, placement, onOpenFullEditor }: QuickAddPaletteProps) {
	const [value, setValue] = useState('')
	// The line under the search: what the last Enter added, or that the dashboard is not ready to take it yet (a
	// wait, not an error). Both clear after a moment.
	const [status, setStatus] = useState<{ tone: 'added' | 'wait'; text: string } | null>(null)
	const [recents, setRecents] = useState<Array<QuickAddRecent>>(readQuickAddRecents)
	const lastAddedIdRef = useRef<string | null>(null)
	const statusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const inputRef = useRef<HTMLInputElement | null>(null)
	const openingEditorRef = useRef(false)
	const { protocols, chains, protocolsLoading, parentMapping } = useProDashboardCatalog()
	const { loading, error, availableProtocolChartTypes, availableChainChartTypes } = useAppMetadata()
	const { handleAppendItems } = useProDashboardEditorActions()
	const { items } = useProDashboardItemsState()
	const combobox = Ariakit.useComboboxStore({ open: true, value, setValue })
	const activeId = Ariakit.useStoreState(combobox, 'activeId')

	useEffect(
		() => () => {
			if (statusTimeoutRef.current !== null) clearTimeout(statusTimeoutRef.current)
		},
		[]
	)

	const entities = useMemo(
		() => buildQuickAddIndex({ protocols, chains, parentMapping }),
		[protocols, chains, parentMapping]
	)
	const availability = useMemo<QuickAddAvailability>(
		() => ({
			loading,
			error: error !== undefined,
			forProtocol: (slug: string, hasGeckoId: boolean) => availableProtocolChartTypes(slug, { hasGeckoId }),
			forChain: (name: string, hasGeckoId: boolean) => availableChainChartTypes(name, { hasGeckoId })
		}),
		[loading, error, availableProtocolChartTypes, availableChainChartTypes]
	)
	const deferredValue = useDeferredValue(value)
	const query = useMemo(() => parseQuickAddQuery(deferredValue), [deferredValue])
	const suggestions = useMemo(
		() => buildQuickAddSuggestions({ query, entities, availability, existingItems: items, recents }),
		[query, entities, availability, items, recents]
	)
	const grouped = isQuickAddQueryEmpty(query)
	const activeIndex = suggestions.findIndex((_, index) => rowElementId(index) === activeId)

	function openFullEditor(draftItem: DashboardItemConfig | null) {
		openingEditorRef.current = true
		onOpenFullEditor({
			...(placement === undefined ? {} : { placement }),
			...(draftItem === null ? {} : { draftItem })
		})
	}

	function showStatus(next: { tone: 'added' | 'wait'; text: string }) {
		if (statusTimeoutRef.current !== null) clearTimeout(statusTimeoutRef.current)
		setStatus(next)
		statusTimeoutRef.current = setTimeout(() => {
			statusTimeoutRef.current = null
			setStatus(null)
		}, TOAST_DURATION_SHORT)
	}

	function handleClose() {
		const lastAddedId = lastAddedIdRef.current
		lastAddedIdRef.current = null
		if (lastAddedId !== null) requestDashboardItemReveal(lastAddedId)
		onClose()
	}

	function completeAdd(suggestion: QuickAddSuggestion, addedId: string | null, closeAfter: boolean) {
		const recent = suggestionRecent(suggestion)
		if (recent !== null) setRecents(pushQuickAddRecent(recent))
		setValue('')
		if (suggestion.afterAdd === 'close-and-focus-title') {
			lastAddedIdRef.current = null
			if (addedId !== null) requestDashboardItemReveal(addedId, { focusTitle: true })
			onClose()
			return
		}
		if (addedId !== null) lastAddedIdRef.current = addedId
		showStatus({ tone: 'added', text: `Added ${suggestion.title}` })
		if (closeAfter) {
			handleClose()
			return
		}
		inputRef.current?.focus()
	}

	function selectSuggestion(suggestion: QuickAddSuggestion, closeAfter: boolean) {
		if (suggestion.action === 'open-editor') {
			openFullEditor(null)
			return
		}
		if (suggestion.action === 'open-editor-draft') {
			openFullEditor(suggestion.build([])[0] ?? null)
			return
		}
		const added = handleAppendItems(suggestion.build, placement)
		if (added.status === 'refused') {
			// The palette stays open, so the refusal (still loading, or over the size limit) shows in its status line.
			showStatus({ tone: 'wait', text: added.reason })
			return
		}
		completeAdd(suggestion, added.ids[0] ?? null, closeAfter)
	}

	function customizeSuggestion(suggestion: QuickAddSuggestion) {
		const draftItem = suggestionDraftItem(suggestion)
		if (draftItem === null) return
		openFullEditor(draftItem)
	}

	function handleKeyDownCapture(event: KeyboardEvent<HTMLInputElement>) {
		if (event.key === 'Escape') {
			event.preventDefault()
			handleClose()
			return
		}
		if (event.key !== 'Enter' && event.key !== 'Tab') return
		if (event.ctrlKey || event.metaKey || event.altKey) return
		if (event.nativeEvent.isComposing) {
			event.stopPropagation()
			return
		}
		const suggestion =
			value === deferredValue
				? suggestions[activeIndex === -1 ? 0 : activeIndex]
				: buildLeadingQuickAddSuggestion(value, { entities, availability, existingItems: items, recents })
		if (suggestion === undefined) return
		if (event.key === 'Tab') {
			if (event.shiftKey || suggestionDraftItem(suggestion) === null) return
			event.preventDefault()
			customizeSuggestion(suggestion)
			return
		}
		event.preventDefault()
		selectSuggestion(suggestion, event.shiftKey)
	}

	const rows = suggestions.map((suggestion, index) => (
		<QuickAddRow
			key={suggestion.id}
			suggestion={suggestion}
			index={index}
			onSelect={selectSuggestion}
			onCustomize={customizeSuggestion}
		/>
	))

	return (
		<Dialog
			size="md"
			scope="pro"
			open={open}
			onClose={handleClose}
			onClosed={onClosed}
			portal
			unmountOnHide
			autoFocusOnHide={() => !openingEditorRef.current}
		>
			<Ariakit.ComboboxProvider store={combobox}>
				<DialogSearchHeader title="Quick add">
					<Ariakit.Combobox
						ref={inputRef}
						autoFocus
						autoSelect="always"
						aria-label="Quick add"
						placeholder={QUICK_ADD_PLACEHOLDER}
						className={inputStyles}
						onKeyDownCapture={handleKeyDownCapture}
					/>
				</DialogSearchHeader>
				{/* Its own row under the header, so a message never pushes the × out of line with the search. The live
				    region stays mounted so each message is announced. */}
				<p role="status" className="shrink-0 px-5 pt-3 body-sm empty:hidden">
					{status ? (
						<span
							key={status.text}
							className={`inline-block animate-pro-fade-in ${status.tone === 'wait' ? 'text-warning' : 'text-secondary'}`}
						>
							{status.text}
						</span>
					) : null}
				</p>
				<DialogBody kind="list">
					<Ariakit.ComboboxList alwaysVisible aria-label="Quick add suggestions">
						{protocolsLoading ? (
							<div role="status" aria-live="polite" className="px-2 py-2">
								<LoadingIndicator label="Loading protocols" />
							</div>
						) : null}
						{grouped
							? GROUP_ORDER.map((group) => {
									const groupRows = rows.filter((_, index) => suggestions[index]?.group === group)
									if (groupRows.length === 0) return null
									return (
										<Ariakit.ComboboxGroup key={group}>
											<Ariakit.ComboboxGroupLabel className="px-3 pt-2 pb-1 label-sm text-tertiary">
												{GROUP_LABELS[group]}
											</Ariakit.ComboboxGroupLabel>
											{groupRows}
										</Ariakit.ComboboxGroup>
									)
								})
							: null}
						{grouped ? rows.filter((_, index) => suggestions[index]?.group === undefined) : rows}
					</Ariakit.ComboboxList>
				</DialogBody>
				<DialogFooter
					leading={
						<span className="hidden items-center gap-1.5 body-sm text-tertiary md:flex">
							<kbd className={KBD_STYLES}>↵</kbd>
							add
							<span aria-hidden="true">·</span>
							<kbd className={KBD_STYLES}>⇧↵</kbd>
							add &amp; close
							<span aria-hidden="true">·</span>
							<kbd className={KBD_STYLES}>Tab</kbd>
							customize
							<span aria-hidden="true">·</span>
							<kbd className={KBD_STYLES}>Esc</kbd>
							close
						</span>
					}
				>
					<Button
						type="button"
						size="md"
						data-umami-event="dashboard-quick-add-open-editor"
						onClick={() => openFullEditor(null)}
					>
						All card types…
					</Button>
				</DialogFooter>
			</Ariakit.ComboboxProvider>
		</Dialog>
	)
}
