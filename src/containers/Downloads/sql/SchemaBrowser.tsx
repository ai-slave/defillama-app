import { matchSorter } from 'match-sorter'
import { useCallback, useDeferredValue, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { VirtualizedSelect } from '~/components/Select/VirtualizedSelect'
import { getStorageJSON, setStorageJSON } from '~/contexts/localStorageStore'
import { Button } from '~/ui/Button'
import { keepFocus } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { Input, searchFieldIconStyles } from '~/ui/Input'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { InlineStatus } from '~/ui/Status'
import { Tag } from '~/ui/Tag'
import { formatNumber } from '~/utils/numberFormat'
import {
	chartDatasets,
	chartDatasetCategories,
	type ChartDatasetDefinition,
	type ChartOptionsMap
} from '../chart-datasets'
import { datasets, datasetCategories, type DatasetDefinition } from '../datasets'
import { CopyTextButton } from './CopyTextButton'
import { formatDownloadRowCount } from './format'
import { inferColumnKind, TypeBadge } from './primitives'
import { columnShapeFor } from './schemaShapes'
import {
	identifierize,
	tableNameFor,
	type RegisteredTable,
	type TableLoadError,
	type TableSource
} from './useTableRegistry'

const COLLAPSED_KEY = 'sql-schema-collapsed-categories'

const FILTER_KINDS = ['all', 'flat', 'timeseries'] as const
type FilterKind = (typeof FILTER_KINDS)[number]

const FILTER_LABELS: Record<FilterKind, string> = {
	all: 'All',
	flat: 'Datasets',
	timeseries: 'Time series'
}

export interface SchemaBrowserProps {
	chartOptionsMap: ChartOptionsMap
	loadedTables: Array<RegisteredTable>
	onLoad: (source: TableSource) => Promise<RegisteredTable | null>
	onReplaceSql: (snippet: string) => void
	/** Null while no editor can take a column name (a notebook tab): the columns are listed, not offered. */
	onInsertAtCursor: ((text: string) => void) | null
	loading: string | null
	/** The last table that failed to load; its row shows why. */
	loadError: TableLoadError | null
	/** The parameter picked per time-series slug. Rows unmount on a tab switch, a collapse or a search, so the
	    host that stays mounted keeps the picks, and each row reads its load state for the table they name. */
	pickedParams: Record<string, string>
	setPickedParams: Dispatch<SetStateAction<Record<string, string>>>
}

type SchemaEntry =
	| {
			kind: 'flat'
			id: string
			category: string
			tableName: string
			description: string
			dataset: DatasetDefinition
	  }
	| {
			kind: 'ts'
			id: string
			category: string
			displayName: string
			slug: string
			description: string
			dataset: ChartDatasetDefinition
	  }

export function SchemaBrowser({
	chartOptionsMap,
	loadedTables,
	onLoad,
	onReplaceSql,
	onInsertAtCursor,
	loading,
	loadError,
	pickedParams,
	setPickedParams
}: SchemaBrowserProps) {
	const [search, setSearch] = useState('')
	const [filter, setFilter] = useState<FilterKind>('all')
	const deferred = useDeferredValue(search)

	const [collapsed, setCollapsed] = useState<Set<string>>(
		() => new Set(getStorageJSON<Array<string>>(COLLAPSED_KEY, []))
	)

	const toggleCollapsed = useCallback((category: string) => {
		setCollapsed((prev) => {
			const next = new Set(prev)
			if (next.has(category)) next.delete(category)
			else next.add(category)
			setStorageJSON(COLLAPSED_KEY, [...next])
			return next
		})
	}, [])

	const allEntries = useMemo<Array<SchemaEntry>>(() => {
		const out: Array<SchemaEntry> = []
		for (const d of datasets) {
			out.push({
				kind: 'flat',
				id: `flat:${d.slug}`,
				category: d.category,
				tableName: identifierize(d.slug),
				description: d.description,
				dataset: d
			})
		}
		for (const d of chartDatasets) {
			out.push({
				kind: 'ts',
				id: `ts:${d.slug}`,
				category: d.category,
				displayName: `ts_${identifierize(d.slug)}_<${d.paramLabel.toLowerCase()}>`,
				slug: d.slug,
				description: d.description,
				dataset: d
			})
		}
		return out
	}, [])

	const filtered = useMemo(() => {
		let list = allEntries
		if (filter === 'flat') list = list.filter((e) => e.kind === 'flat')
		else if (filter === 'timeseries') list = list.filter((e) => e.kind === 'ts')
		if (!deferred) return list
		const toName = (e: SchemaEntry) => (e.kind === 'flat' ? e.tableName : e.displayName)
		const toDataFields = (e: SchemaEntry) =>
			e.kind === 'flat'
				? (e.dataset.fields ?? []).join(' ')
				: columnShapeFor(e.slug) === 'dynamic'
					? ''
					: (columnShapeFor(e.slug) as ReadonlyArray<string>).join(' ')
		return matchSorter(list, deferred, {
			keys: [toName, 'description', 'category', toDataFields],
			threshold: matchSorter.rankings.CONTAINS
		})
	}, [allEntries, deferred, filter])

	const grouped = useMemo(() => {
		const byCategory = new Map<string, Array<SchemaEntry>>()
		for (const e of filtered) {
			const arr = byCategory.get(e.category) ?? []
			arr.push(e)
			byCategory.set(e.category, arr)
		}
		const ordered: Array<string> = []
		const seen = new Set<string>()
		for (const c of [...datasetCategories, ...chartDatasetCategories]) {
			if (byCategory.has(c) && !seen.has(c)) {
				ordered.push(c)
				seen.add(c)
			}
		}
		return ordered.map((c) => ({ category: c, items: byCategory.get(c)! }))
	}, [filtered])

	const loadedByKey = useMemo(() => {
		const m = new Map<string, RegisteredTable>()
		for (const t of loadedTables) {
			if (t.source.kind === 'dataset') m.set(`flat:${t.source.slug}`, t)
			else m.set(`ts:${t.source.slug}:${t.source.param}`, t)
		}
		return m
	}, [loadedTables])

	const totalVisible = filtered.length

	return (
		<div className="flex flex-col gap-5">
			<BrowserHeader
				search={search}
				onSearchChange={setSearch}
				filter={filter}
				onFilterChange={setFilter}
				totalVisible={totalVisible}
				totalAvailable={allEntries.length}
			/>

			{grouped.length === 0 ? (
				<EmptyResults search={deferred} />
			) : (
				<div className="flex flex-col gap-5">
					{grouped.map(({ category, items }) => (
						<CategorySection
							key={category}
							category={category}
							items={items}
							collapsed={collapsed.has(category)}
							onToggle={() => toggleCollapsed(category)}
							loadedByKey={loadedByKey}
							chartOptionsMap={chartOptionsMap}
							onReplaceSql={onReplaceSql}
							onInsertAtCursor={onInsertAtCursor}
							onLoad={onLoad}
							loading={loading}
							loadError={loadError}
							pickedParams={pickedParams}
							setPickedParams={setPickedParams}
						/>
					))}
				</div>
			)}
		</div>
	)
}

function BrowserHeader({
	search,
	onSearchChange,
	filter,
	onFilterChange,
	totalVisible,
	totalAvailable
}: {
	search: string
	onSearchChange: (v: string) => void
	filter: FilterKind
	onFilterChange: (k: FilterKind) => void
	totalVisible: number
	totalAvailable: number
}) {
	return (
		<div className="flex flex-col gap-3">
			<SearchField
				value={search}
				onChange={onSearchChange}
				label="Search schema"
				placeholder="Search tables, columns, descriptions…"
			/>
			<div className="flex flex-wrap items-center justify-between gap-3">
				<SegmentedControl
					label="Dataset kind"
					variant="default"
					size="md"
					value={filter}
					onValueChange={onFilterChange}
					options={FILTER_KINDS.map((kind) => ({ value: kind, label: FILTER_LABELS[kind] }))}
				/>
				<p className="body-sm text-tertiary">
					{totalVisible === totalAvailable ? `${totalAvailable} tables` : `${totalVisible} of ${totalAvailable} tables`}
				</p>
			</div>
		</div>
	)
}

/** The search field used by every SQL reference tab. */
export function SearchField({
	value,
	onChange,
	label,
	placeholder
}: {
	value: string
	onChange: (v: string) => void
	label: string
	placeholder: string
}) {
	const inputRef = useRef<HTMLInputElement>(null)
	return (
		<div className="relative">
			<Icon name="search" height={16} width={16} className={searchFieldIconStyles} />
			<Input
				ref={inputRef}
				type="text"
				inputMode="search"
				aria-label={label}
				placeholder={placeholder}
				value={value}
				onInput={(e) => onChange(e.currentTarget.value)}
				className="w-full pr-9 pl-8"
			/>
			{value ? (
				<Button
					type="button"
					variant="ghost"
					size="sm"
					square
					onClick={() =>
						keepFocus(
							() => onChange(''),
							() => inputRef.current
						)
					}
					aria-label="Clear search"
					className="absolute top-1/2 right-1.5 -translate-y-1/2"
				>
					<Icon name="x" className="size-3.5" aria-hidden="true" />
				</Button>
			) : null}
		</div>
	)
}

function EmptyResults({ search }: { search: string }) {
	return (
		<p className="py-6 text-center body-sm text-tertiary">
			{search ? `No tables match "${search}".` : 'No tables match these filters.'}
		</p>
	)
}

function CategorySection({
	category,
	items,
	collapsed,
	onToggle,
	loadedByKey,
	chartOptionsMap,
	onReplaceSql,
	onInsertAtCursor,
	onLoad,
	loading,
	loadError,
	pickedParams,
	setPickedParams
}: {
	category: string
	items: Array<SchemaEntry>
	collapsed: boolean
	onToggle: () => void
	loadedByKey: Map<string, RegisteredTable>
	chartOptionsMap: ChartOptionsMap
	onReplaceSql: (snippet: string) => void
	onInsertAtCursor: ((text: string) => void) | null
	onLoad: (source: TableSource) => Promise<RegisteredTable | null>
	loading: string | null
	loadError: TableLoadError | null
	pickedParams: Record<string, string>
	setPickedParams: Dispatch<SetStateAction<Record<string, string>>>
}) {
	return (
		<section className="flex flex-col">
			<h3>
				<button
					type="button"
					onClick={onToggle}
					aria-expanded={!collapsed}
					className="flex w-full items-center gap-2 border-b border-subtle pb-2 text-left label-md text-primary"
				>
					<Icon
						name="chevron-right"
						className={`size-4 shrink-0 text-tertiary transition-transform duration-150 ${collapsed ? '' : 'rotate-90'}`}
						aria-hidden="true"
					/>
					{category}
					<span className="body-sm text-tertiary">{items.length}</span>
				</button>
			</h3>

			{!collapsed && (
				<ul className="flex flex-col divide-y divide-(--border-subtle)">
					{items.map((item) =>
						item.kind === 'flat' ? (
							<li key={item.id}>
								<FlatRow
									entry={item}
									loaded={loadedByKey.get(item.id)}
									onReplaceSql={onReplaceSql}
									onInsertAtCursor={onInsertAtCursor}
									onLoad={onLoad}
									loading={loading}
									loadError={loadError}
								/>
							</li>
						) : (
							<li key={item.id}>
								<TsRow
									entry={item}
									options={chartOptionsMap[item.dataset.slug] ?? []}
									loadedByKey={loadedByKey}
									onReplaceSql={onReplaceSql}
									onInsertAtCursor={onInsertAtCursor}
									onLoad={onLoad}
									loading={loading}
									loadError={loadError}
									param={pickedParams[item.slug] ?? ''}
									setParam={(param) => setPickedParams((prev) => ({ ...prev, [item.slug]: param }))}
								/>
							</li>
						)
					)}
				</ul>
			)}
		</section>
	)
}

function FlatRow({
	entry,
	loaded,
	onReplaceSql,
	onInsertAtCursor,
	onLoad,
	loading,
	loadError
}: {
	entry: Extract<SchemaEntry, { kind: 'flat' }>
	loaded: RegisteredTable | undefined
	onReplaceSql: (snippet: string) => void
	onInsertAtCursor: ((text: string) => void) | null
	onLoad: (source: TableSource) => Promise<RegisteredTable | null>
	loading: string | null
	loadError: TableLoadError | null
}) {
	const snippet = `SELECT * FROM ${entry.tableName} LIMIT 100\n`
	const isLoading = loading === entry.tableName

	const staticFields = entry.dataset.fields ?? []
	const loadedCols = loaded?.columns ?? []
	const typeByName = new Map(loadedCols.map((c) => [c.name, c.type]))
	const columns =
		staticFields.length > 0
			? staticFields.map((name) => ({ name, type: typeByName.get(name) }))
			: loadedCols.map((c) => ({ name: c.name, type: c.type }))

	return (
		<div className="flex flex-col gap-2 py-3">
			<div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
				<div className="flex min-w-0 grow basis-48 flex-col gap-1">
					<div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
						<span className="mono-md break-all text-primary">{entry.tableName}</span>
						<Tag>Dataset</Tag>
						{loaded ? <LoadedNote rowCount={loaded.rowCount} /> : null}
					</div>
					<p className="body-sm text-secondary">{entry.description}</p>
				</div>
				<RowActions
					tableName={entry.tableName}
					onInsert={() => onReplaceSql(snippet)}
					onLoad={() => {
						onLoad({ kind: 'dataset', slug: entry.dataset.slug })
					}}
					isLoading={isLoading}
					alreadyLoaded={!!loaded}
					canLoad={!loading}
				/>
			</div>

			{columns.length > 0 ? (
				<ColumnChips columns={columns} onInsertColumn={onInsertAtCursor} />
			) : (
				<p className="body-sm text-tertiary">Columns show once the table loads.</p>
			)}
			{loadError?.table === entry.tableName ? <InlineStatus variant="error">{loadError.message}</InlineStatus> : null}
		</div>
	)
}

function TsRow({
	entry,
	options,
	loadedByKey,
	onReplaceSql,
	onInsertAtCursor,
	onLoad,
	loading,
	loadError,
	param,
	setParam
}: {
	entry: Extract<SchemaEntry, { kind: 'ts' }>
	options: Array<{ label: string; value: string; category?: string; isChild?: boolean }>
	loadedByKey: Map<string, RegisteredTable>
	onReplaceSql: (snippet: string) => void
	onInsertAtCursor: ((text: string) => void) | null
	onLoad: (source: TableSource) => Promise<RegisteredTable | null>
	loading: string | null
	loadError: TableLoadError | null
	param: string
	setParam: (param: string) => void
}) {
	const selectedOption = options.find((o) => o.value === param)
	const resolvedName = param ? tableNameFor({ kind: 'chart', slug: entry.slug, param }) : entry.displayName
	const loaded = param ? loadedByKey.get(`ts:${entry.slug}:${param}`) : undefined
	const isLoading = !!param && loading === resolvedName
	const snippet = `SELECT * FROM ${resolvedName} LIMIT 100\n`

	const shape = columnShapeFor(entry.slug)
	const loadedCols = loaded?.columns ?? []
	const typeByName = new Map(loadedCols.map((c) => [c.name, c.type]))
	let columns: Array<{ name: string; type?: string }> = []
	if (shape === 'dynamic') {
		columns = loadedCols.map((c) => ({ name: c.name, type: c.type }))
	} else {
		columns = shape.map((name) => ({ name, type: typeByName.get(name) }))
	}

	return (
		<div className="flex flex-col gap-2 py-3">
			<div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
				<div className="flex min-w-0 grow basis-48 flex-col gap-1">
					<div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
						<span className={`mono-md break-all ${param ? 'text-primary' : 'text-secondary'}`}>{resolvedName}</span>
						<Tag>Time series</Tag>
						{loaded ? <LoadedNote rowCount={loaded.rowCount} /> : null}
					</div>
					<p className="body-sm text-secondary">{entry.description}</p>
				</div>
				<RowActions
					tableName={resolvedName}
					onInsert={() => onReplaceSql(snippet)}
					onLoad={() => {
						if (!param || !selectedOption) return
						onLoad({
							kind: 'chart',
							slug: entry.slug,
							param: selectedOption.value,
							paramLabel: selectedOption.label
						})
					}}
					isLoading={isLoading}
					alreadyLoaded={!!loaded}
					canLoad={!!param && !loading}
					blocked={!param}
				/>
			</div>

			<ParamCombobox paramLabel={entry.dataset.paramLabel} options={options} value={param} onChange={setParam} />

			{columns.length > 0 ? (
				<ColumnChips columns={columns} onInsertColumn={onInsertAtCursor} />
			) : shape === 'dynamic' ? (
				<p className="body-sm text-tertiary">Columns depend on the response and show once the table loads.</p>
			) : null}
			{param && loadError?.table === resolvedName ? (
				<InlineStatus variant="error">{loadError.message}</InlineStatus>
			) : null}
		</div>
	)
}

function ColumnChips({
	columns,
	onInsertColumn
}: {
	columns: Array<{ name: string; type?: string }>
	onInsertColumn: ((name: string) => void) | null
}) {
	const chip = 'inline-flex min-h-6 items-center gap-1 rounded-md border border-subtle px-1.5 mono-sm text-primary'
	return (
		<ul
			aria-label={onInsertColumn ? 'Columns, select one to insert it in the editor' : 'Columns'}
			className="flex flex-wrap gap-1.5"
		>
			{columns.map((c) => {
				const content = (
					<>
						{c.type ? <TypeBadge kind={inferColumnKind(c.type)} /> : null}
						{c.name}
					</>
				)
				return (
					<li key={c.name}>
						{onInsertColumn ? (
							<button
								type="button"
								onClick={() => onInsertColumn(c.name)}
								className={`touch-target hover-wash hover:border-brand ${chip}`}
							>
								{content}
							</button>
						) : (
							<span className={chip}>{content}</span>
						)}
					</li>
				)
			})}
		</ul>
	)
}

function RowActions({
	tableName,
	onInsert,
	onLoad,
	isLoading,
	alreadyLoaded,
	canLoad,
	blocked = false
}: {
	tableName: string
	onInsert: () => void
	onLoad: () => void
	isLoading: boolean
	alreadyLoaded: boolean
	canLoad: boolean
	/** A time-series table needs its parameter first; the picker under the name asks for it. */
	blocked?: boolean
}) {
	return (
		<div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
			<CopyTextButton text={tableName} label="Copy name" disabled={blocked} />
			<Button
				type="button"
				size="sm"
				onClick={onLoad}
				disabled={!isLoading && (!canLoad || alreadyLoaded)}
				// Load turns into a disabled Loaded once its table lands, so it keeps focus.
				accessibleWhenDisabled
				pendingLabel={isLoading ? 'Loading…' : null}
			>
				{alreadyLoaded ? 'Loaded' : 'Load'}
			</Button>
			<Button type="button" size="sm" onClick={onInsert} disabled={blocked}>
				Insert
			</Button>
		</div>
	)
}

function ParamCombobox({
	paramLabel,
	options,
	value,
	onChange
}: {
	paramLabel: string
	options: Array<{ label: string; value: string; category?: string; isChild?: boolean }>
	value: string
	onChange: (next: string) => void
}) {
	const triggerRef = useRef<HTMLButtonElement>(null)
	const noun = paramLabel.toLowerCase()

	if (options.length === 0) {
		return <p className="body-sm text-tertiary">No {noun} options available.</p>
	}

	return (
		<div className="flex flex-wrap items-center gap-2">
			<VirtualizedSelect
				variant="chip"
				label={paramLabel}
				placeholder={`Pick a ${noun}`}
				options={options}
				selectedValue={value || null}
				onChange={(option) => onChange(option.value)}
				triggerRef={triggerRef}
			/>
			{value ? (
				<Button
					type="button"
					variant="ghost"
					size="sm"
					onClick={() =>
						keepFocus(
							() => onChange(''),
							() => triggerRef.current
						)
					}
				>
					Clear
				</Button>
			) : null}
			<span className="ml-auto body-sm text-tertiary">
				{formatNumber(options.length)} {options.length === 1 ? 'option' : 'options'}
			</span>
		</div>
	)
}

function LoadedNote({ rowCount }: { rowCount: number }) {
	return <span className="body-sm text-tertiary">{formatDownloadRowCount(rowCount)} rows</span>
}
