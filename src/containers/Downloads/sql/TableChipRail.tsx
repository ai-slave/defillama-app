import { useState } from 'react'
import { toast } from 'react-hot-toast'
import { Button } from '~/ui/Button'
import { keepFocus, neighbourRowControl, passFocusOnLeave } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { LoadingSpinner } from '~/ui/Loaders'
import { Tooltip } from '~/ui/Tooltip'
import { inferFineKindFromArrowType } from './columnKind'
import { formatDownloadRowCount } from './format'
import { buildLlmInstructions } from './llmInstructions'
import { SectionLabel, TypeBadge } from './primitives'
import { prettyLabelForSource, type RegisteredTable } from './useTableRegistry'

export type PendingTableStatus = 'pending' | 'loading' | 'failed'

export interface PendingTable {
	key: string
	name: string
	label: string
	status: PendingTableStatus
}

interface TableChipRailProps {
	tables: Array<RegisteredTable>
	onBrowseSchema: () => void
	onRemove: (name: string) => void
	pending?: Array<PendingTable>
	totalSchemaCount: number
}

const EMPTY_PENDING: NonNullable<TableChipRailProps['pending']> = []

export function TableChipRail({
	tables,
	onBrowseSchema,
	onRemove,
	pending = EMPTY_PENDING,
	totalSchemaCount
}: TableChipRailProps) {
	const [openName, setOpenName] = useState<string | null>(null)
	const openTable = openName ? (tables.find((t) => t.name === openName) ?? null) : null
	const totalCount = tables.length + pending.length

	return (
		<section aria-label="Loaded tables" tabIndex={-1} className="flex flex-col gap-2">
			<SectionLabel
				label="Tables"
				count={totalCount}
				action={
					totalCount > 0 ? (
						<div className="flex items-center gap-1.5">
							<CopyForAIButton />
							<Button variant="outline" size="sm" onClick={onBrowseSchema}>
								<Icon name="layers" className="size-3.5" />
								Browse schema
								<span className="tabular-nums">{totalSchemaCount}</span>
							</Button>
						</div>
					) : null
				}
			/>

			{totalCount === 0 ? (
				<EmptyTablesPrompt onBrowseSchema={onBrowseSchema} totalSchemaCount={totalSchemaCount} />
			) : (
				<div className="flex flex-wrap items-center gap-1.5" aria-live="polite">
					{tables.map((t) => {
						const isOpen = openName === t.name
						return (
							<TableChip
								key={t.name}
								table={t}
								open={isOpen}
								onToggle={() => setOpenName(isOpen ? null : t.name)}
								onRemove={() => {
									if (isOpen) setOpenName(null)
									onRemove(t.name)
								}}
							/>
						)
					})}
					{pending.map((p) => (
						<PendingChip key={p.key} table={p} />
					))}
				</div>
			)}

			{openTable ? <ColumnDrawer table={openTable} onClose={() => setOpenName(null)} /> : null}
		</section>
	)
}

function TableChip({
	table,
	open,
	onToggle,
	onRemove
}: {
	table: RegisteredTable
	open: boolean
	onToggle: () => void
	onRemove: () => void
}) {
	return (
		<div
			className={`group flex items-stretch overflow-hidden rounded-md border transition-colors ${
				open ? 'border-brand/60 bg-brand/5' : 'border-subtle bg-surface hover:border-brand/40'
			}`}
		>
			<button
				type="button"
				onClick={onToggle}
				aria-expanded={open}
				className="flex items-center gap-1.5 px-2.5 py-1 label-sm text-pro-text-primary"
			>
				<Icon
					name="chevron-right"
					className={`size-3 shrink-0 text-pro-text-tertiary transition-transform ${open ? 'rotate-90 text-link' : ''}`}
				/>
				<span className="max-w-[180px] truncate font-mono">{table.name}</span>
				<span className="text-pro-text-tertiary tabular-nums">· {formatDownloadRowCount(table.rowCount)}</span>
			</button>
			<Tooltip
				content="Remove"
				render={
					<button
						ref={focusNeighbourChipOnLeave}
						type="button"
						onClick={onRemove}
						aria-label={`Remove ${table.name}`}
						className="flex w-6 items-center justify-center border-l border-subtle text-pro-text-tertiary opacity-0 transition-all group-hover:opacity-100 hover:bg-hover-row hover:text-pro-text-primary focus-visible:opacity-100 pointer-coarse:opacity-100"
					/>
				}
			>
				<Icon name="x" className="size-4" />
			</Tooltip>
		</div>
	)
}

// The table drops once DuckDB does, after the press: the next chip's × takes focus, else the tables section.
const focusNeighbourChipOnLeave = passFocusOnLeave(
	(node) => neighbourRowControl(node.parentElement!, node) ?? node.closest<HTMLElement>('section')
)

function PendingChip({ table }: { table: PendingTable }) {
	const { status } = table
	const failed = status === 'failed'
	const loading = status === 'loading'
	return (
		<div
			role="status"
			aria-label={
				failed ? `Failed to load ${table.label}` : loading ? `Loading ${table.label}` : `Queued ${table.label}`
			}
			title={table.label}
			className={`flex items-center gap-1.5 overflow-hidden rounded-md border border-dashed px-2.5 py-1 body-sm transition-colors ${
				failed
					? 'border-error/50 bg-error/5 text-error'
					: loading
						? 'border-brand/40 bg-brand/5 text-pro-text-primary'
						: 'border-subtle bg-surface/40 text-pro-text-secondary'
			} ${loading ? 'animate-pulse' : ''}`}
		>
			<span className="flex size-3 shrink-0 items-center justify-center">
				{failed ? (
					<Icon name="alert-triangle" className="size-3 text-error" />
				) : loading ? (
					<LoadingSpinner size={10} />
				) : (
					<span className="size-1.5 rounded-full bg-pro-text-tertiary/60" />
				)}
			</span>
			<span className="max-w-[180px] truncate font-mono">{table.name}</span>
			<span
				className={`body-xs tracking-wide uppercase tabular-nums ${
					failed ? 'text-error/80' : 'text-pro-text-tertiary'
				}`}
			>
				{failed ? 'failed' : loading ? 'loading' : 'queued'}
			</span>
		</div>
	)
}

function ColumnDrawer({ table, onClose }: { table: RegisteredTable; onClose: () => void }) {
	return (
		<div className="rounded-md border border-subtle bg-surface px-3 py-2.5">
			<div className="flex items-baseline justify-between gap-3">
				<div className="flex flex-wrap items-baseline gap-2 body-sm">
					<span className="font-mono font-bold text-pro-text-primary">{table.name}</span>
					<span className="text-pro-text-tertiary">
						{table.columns.length} cols · {prettyLabelForSource(table.source)}
					</span>
				</div>
				<Tooltip
					content="Close column list"
					render={
						<Button
							variant="ghost"
							size="sm"
							square
							onClick={(event) => {
								// Closing removes this button; focus returns to the chip that opened the list.
								const chip = event.currentTarget
									.closest('section')
									?.querySelector<HTMLElement>('[aria-expanded="true"]')
								keepFocus(onClose, () => chip)
							}}
							aria-label="Close column list"
						/>
					}
				>
					<Icon name="x" className="size-4" />
				</Tooltip>
			</div>
			<ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5">
				{table.columns.map((c) => (
					<li
						key={c.name}
						className="flex items-center gap-1.5 body-sm"
						title={c.type ? `${c.name} · ${c.type}` : c.name}
					>
						<TypeBadge kind={inferFineKindFromArrowType(c.type)} />
						<span className="truncate font-mono text-pro-text-primary">{c.name}</span>
					</li>
				))}
			</ul>
		</div>
	)
}

function EmptyTablesPrompt({
	onBrowseSchema,
	totalSchemaCount
}: {
	onBrowseSchema: () => void
	totalSchemaCount: number
}) {
	return (
		<div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-subtle bg-surface/60 px-3 py-2 body-sm text-pro-text-secondary">
			<span className="text-pro-text-primary">
				No tables loaded — type a table name in SQL to auto-load on run, or pick from the catalogue.
			</span>
			<span className="ml-auto flex items-center gap-1.5">
				<CopyForAIButton />
				<Button variant="primary" size="sm" onClick={onBrowseSchema}>
					<Icon name="layers" className="size-3.5" />
					Browse datasets
					<span className="tabular-nums">{totalSchemaCount}</span>
				</Button>
			</span>
		</div>
	)
}

function CopyForAIButton() {
	const [copied, setCopied] = useState(false)

	const onCopy = async () => {
		if (typeof navigator === 'undefined' || !navigator.clipboard) {
			toast.error('Clipboard unavailable')
			return
		}
		try {
			const brief = buildLlmInstructions()
			await navigator.clipboard.writeText(brief)
			setCopied(true)
			toast.success('Paste into ChatGPT / Claude / Gemini, then ask for a query', { duration: 2600 })
			window.setTimeout(() => setCopied(false), 2000)
		} catch {
			toast.error('Copy failed')
		}
	}

	return (
		<Tooltip
			content="Copies a dataset and SQL dialect brief to paste into an AI assistant."
			render={<Button variant="secondary" size="sm" onClick={onCopy} />}
		>
			<Icon name={copied ? 'check' : 'sparkles'} className="size-3.5" />
			{copied ? 'Copied for AI' : 'Copy for AI'}
		</Tooltip>
	)
}
