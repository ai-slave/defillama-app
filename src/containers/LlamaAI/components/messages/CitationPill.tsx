import * as Ariakit from '@ariakit/react'
import { useMemo, type ReactNode } from 'react'
import type { UnifiedCitationReference } from '~/containers/LlamaAI/types'
import { sanitizeUrl } from '~/containers/LlamaAI/utils/markdownHelpers'
import { Icon } from '~/ui/Icon'
import {
	accentFor,
	badgeFor,
	citedRowDate,
	computedSummaryLabel,
	defaultTierVisible,
	describeFigure,
	domainFromUrl,
	findCitedCell,
	formatMetricValue,
	formatOutputValue,
	friendlyToolName,
	hiddenRowsLabel,
	humanizeColumn,
	iconFor,
	isPrivacySentinel,
	metricLabel,
	mismatchLabel,
	parseRefNumber,
	sanitizeExcerpt,
	shouldFlagMismatch,
	shouldFlagUnverified,
	toolArgRows,
	unverifiedLabel,
	xHandleLabel,
	type CitedCell
} from './citationPillHelpers'
import { useCitationSheet } from './CitationSheetContext'
import { CitationRowsTable } from './ToolDataView'

interface CitationPillProps {
	reference: UnifiedCitationReference
	advancedProvenance?: boolean
}

function openUrl(reference: UnifiedCitationReference): string | null {
	const candidate = reference.url ?? reference.fileUrl
	return candidate ? sanitizeUrl(candidate) : null
}

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
	return (
		<a href={href} target="_blank" rel="noopener noreferrer" className="text-xs text-link hover:underline">
			{children}
		</a>
	)
}

function CodePre({ text, className }: { text: string; className?: string }) {
	return (
		<pre
			className={`m-0 max-h-48 overflow-auto rounded-sm border border-ai-line bg-ai-surface p-1.5 font-mono text-[10px] whitespace-pre-wrap text-ai-secondary ${className ?? ''}`}
		>
			{text}
		</pre>
	)
}

function AdvancedDisclosure({
	label,
	text,
	advancedProvenance
}: {
	label: string
	text: string
	advancedProvenance: boolean
}) {
	if (!text) return null
	return (
		<details open={defaultTierVisible(advancedProvenance)} className="group">
			<summary className="cursor-pointer list-none text-[11px] font-medium text-ai-tertiary hover:text-ai-secondary">
				{label}
			</summary>
			<CodePre text={text} className="mt-1" />
		</details>
	)
}

function SourceMiniCard({ reference }: { reference: UnifiedCitationReference }) {
	const safeUrl = openUrl(reference)
	const hasRows = !!reference.rows && reference.rows.length > 0
	return (
		<div className="rounded-sm border border-ai-line bg-ai-surface p-1.5">
			<div className="flex items-center gap-1.5">
				<span className="text-[10px] font-medium tracking-wide text-ai-accent-blue uppercase">
					{badgeFor(reference.sourceType)}
				</span>
				{reference.label ? <span className="text-[11px] text-ai-tertiary">{reference.label}</span> : null}
				{reference.value ? (
					<span className="ml-auto text-[11px] font-medium text-ai-primary">{reference.value}</span>
				) : null}
			</div>
			{reference.excerpt ? <p className="m-0 mt-1 body-sm text-ai-secondary">{reference.excerpt}</p> : null}
			{hasRows ? (
				<details className="group mt-1">
					<summary className="cursor-pointer list-none text-[10px] font-medium text-ai-muted hover:text-ai-secondary">
						view data
					</summary>
					<CitationRowsTable rows={reference.rows} columns={reference.columns} />
				</details>
			) : null}
			{safeUrl ? <ExternalLink href={safeUrl}>Open source ↗</ExternalLink> : null}
		</div>
	)
}

const ROW_ENTITY_COLS = ['name', 'symbol', 'protocol', 'sub_protocol', 'chain', 'category', 'token_nk']
const ROW_SKIP_COLS = new Set(['date', 'ts', 'ts_close', 'loaded_at', 'canonical_key', '_n'])

function entityName(row: Record<string, unknown>): string | undefined {
	for (const c of ROW_ENTITY_COLS) {
		const v = row[c]
		if (typeof v === 'string' && v.trim() && parseRefNumber(v) == null) {
			return v
				.replace(/^coingecko:/, '')
				.replace(/[-_]/g, ' ')
				.replace(/\b\w/g, (ch) => ch.toUpperCase())
		}
	}
	return undefined
}

function CitedRowCard({ reference, citedCell }: { reference: UnifiedCitationReference; citedCell: CitedCell }) {
	const row = reference.rows?.[citedCell.rowIndex]
	if (!row) return null
	const cols = reference.columns && reference.columns.length > 0 ? reference.columns : Object.keys(row)
	const entity = entityName(row)
	const rowDate = citedRowDate(row, cols)
	const others = cols
		.filter(
			(c) =>
				c !== citedCell.column &&
				!ROW_ENTITY_COLS.includes(c) &&
				!ROW_SKIP_COLS.has(c) &&
				parseRefNumber(row[c] as unknown) != null
		)
		.slice(0, 6)
	return (
		<div className="flex flex-col gap-2 rounded-lg border border-ai-line bg-ai-surface p-3">
			{entity || rowDate ? (
				<div className="flex items-center justify-between gap-2">
					{entity ? (
						<span className="text-[11px] font-semibold tracking-wide text-ai-muted uppercase">{entity}</span>
					) : (
						<span />
					)}
					{rowDate ? (
						<span className="inline-flex items-center gap-1 rounded-full bg-ai-surface-muted px-2 py-0.5 text-[10px] font-medium text-ai-accent-blue">
							<Icon name="calendar" height={9} width={9} />
							{rowDate}
						</span>
					) : null}
				</div>
			) : null}
			<div className="flex items-baseline justify-between gap-3 border-b border-ai-line pb-2">
				<span className="text-xs text-ai-secondary">{metricLabel(citedCell.column)}</span>
				<span className="text-[15px] font-semibold text-ai-accent-blue tabular-nums">
					{formatMetricValue(citedCell.column, row[citedCell.column])}
				</span>
			</div>
			{others.map((c) => (
				<div key={c} className="flex items-baseline justify-between gap-3">
					<span className="text-xs text-ai-tertiary">{metricLabel(c)}</span>
					<span className="text-xs text-ai-secondary tabular-nums">{formatMetricValue(c, row[c])}</span>
				</div>
			))}
		</div>
	)
}

function DataView({
	reference,
	citedCell,
	advancedProvenance
}: {
	reference: UnifiedCitationReference
	citedCell: CitedCell | null
	advancedProvenance: boolean
}) {
	const hasRows = !!reference.rows && reference.rows.length > 0
	const hiddenLabel = reference.rows_omitted ? hiddenRowsLabel(reference.rowCount) : null
	const sql = (reference.sql ?? []).join('\n\n')
	const citedRow = citedCell && reference.rows ? reference.rows[citedCell.rowIndex] : null
	const sources = reference.sources ?? []
	return (
		<>
			{citedRow ? <CitedRowCard reference={reference} citedCell={citedCell} /> : null}
			{sources.length > 0 ? (
				<div className="flex flex-col gap-1.5">
					{sources.map((source, i) => (
						<SourceMiniCard key={source.id ?? i} reference={source} />
					))}
				</div>
			) : null}
			{hasRows ? (
				<details open={!citedRow && sources.length === 0} className="group">
					<summary className="cursor-pointer list-none text-[11px] font-medium text-ai-accent-blue hover:underline">
						<span className="group-open:hidden">{citedRow ? 'Show full table' : 'See the data'}</span>
						<span className="hidden group-open:inline">Hide table</span>
					</summary>
					<CitationRowsTable rows={reference.rows} columns={reference.columns} citedCell={citedCell} />
				</details>
			) : hiddenLabel ? (
				<p className="m-0 text-[10px] text-ai-muted">{hiddenLabel}</p>
			) : null}
			<AdvancedDisclosure label="View query" text={sql} advancedProvenance={advancedProvenance} />
		</>
	)
}

function ComputedView({ reference }: { reference: UnifiedCitationReference }) {
	const sources = reference.sources ?? []
	const summary = !reference.formula ? computedSummaryLabel(reference) : null
	const code = (reference.code ?? []).join('\n\n')
	const outputs = reference.outputs ?? []
	const hasWork = sources.length > 0 || !!code
	return (
		<>
			{reference.formula ? (
				<p className="m-0 font-mono text-xs text-ai-secondary">{reference.formula}</p>
			) : summary ? (
				<p className="m-0 text-xs text-ai-secondary">{summary}</p>
			) : null}
			{outputs.length > 0 ? (
				<div className="flex flex-col gap-1.5 rounded-lg border border-ai-line bg-ai-surface p-3">
					{outputs.map((o) => (
						<div key={o.key} className="flex items-baseline justify-between gap-3">
							<span className="text-xs text-ai-tertiary">{humanizeColumn(o.key)}</span>
							<span className="text-xs font-medium text-ai-secondary tabular-nums">
								{formatOutputValue(o.key, o.value)}
							</span>
						</div>
					))}
				</div>
			) : null}
			{hasWork ? (
				<details open className="group">
					<summary className="cursor-pointer list-none text-[11px] font-medium text-ai-accent-blue hover:underline">
						<span className="group-open:hidden">How this was calculated</span>
						<span className="hidden group-open:inline">Hide calculation</span>
					</summary>
					<div className="mt-1 flex flex-col gap-1.5">
						{sources.map((source, i) => (
							<SourceMiniCard key={source.id ?? i} reference={source} />
						))}
						{code ? <CodePre text={code} /> : null}
					</div>
				</details>
			) : null}
		</>
	)
}

function WebView({ reference }: { reference: UnifiedCitationReference }) {
	const safeUrl = openUrl(reference)
	const domain = domainFromUrl(reference.url)
	const excerpt = sanitizeExcerpt(reference.excerpt)
	return (
		<>
			{domain ? <span className="text-[11px] text-ai-muted">{domain}</span> : null}
			{excerpt ? <p className="m-0 text-xs leading-snug text-ai-secondary">{excerpt}</p> : null}
			{safeUrl ? <ExternalLink href={safeUrl}>Open link ↗</ExternalLink> : null}
		</>
	)
}

function XView({ reference }: { reference: UnifiedCitationReference }) {
	const safeUrl = openUrl(reference)
	const excerpt = sanitizeExcerpt(reference.excerpt)
	return (
		<>
			{excerpt ? <p className="m-0 text-xs leading-snug text-ai-secondary">{excerpt}</p> : null}
			{safeUrl ? <ExternalLink href={safeUrl}>Open tweet ↗</ExternalLink> : null}
		</>
	)
}

function ToolView({ reference }: { reference: UnifiedCitationReference }) {
	const rows = toolArgRows(reference.toolArgs)
	const resultText = reference.resultText
	return (
		<>
			{rows.length > 0 ? (
				<div className="flex flex-col gap-0.5 rounded-sm border border-ai-line bg-ai-surface p-1.5">
					{rows.map((row) => (
						<div key={row.key} className="flex items-baseline gap-2 text-[11px]">
							<span className="shrink-0 font-medium text-ai-tertiary">{row.key}</span>
							<span className="text-ai-secondary">{row.value}</span>
						</div>
					))}
				</div>
			) : null}
			{isPrivacySentinel(resultText) ? (
				<p className="m-0 text-[11px] text-ai-muted">Value hidden for privacy</p>
			) : resultText ? (
				<CodePre text={resultText} />
			) : null}
		</>
	)
}

function FileView({ reference, citedCell }: { reference: UnifiedCitationReference; citedCell: CitedCell | null }) {
	const name = reference.fileName ?? reference.label
	const hasRows = !!reference.rows && reference.rows.length > 0
	const excerpt = sanitizeExcerpt(reference.excerpt)
	return (
		<>
			{name ? (
				<p className="m-0 text-[11px] font-medium text-ai-secondary">
					{name}
					{reference.locator ? ` · ${reference.locator}` : ''}
				</p>
			) : null}
			{excerpt ? <p className="m-0 text-[11px] text-ai-muted">“{excerpt}”</p> : null}
			{hasRows ? <CitationRowsTable rows={reference.rows} columns={reference.columns} citedCell={citedCell} /> : null}
		</>
	)
}

function FactCheckSection({ reference }: { reference: UnifiedCitationReference }) {
	const hasChecked = !!reference.checked
	const hasEvidence = !!reference.evidence && reference.evidence.length > 0
	const hasDetail = !!reference.detail && reference.detail !== reference.value
	if (!hasChecked && !hasEvidence && !hasDetail) return null
	return (
		<div className="flex flex-col gap-1 border-t border-ai-line pt-1.5">
			{hasChecked ? (
				<p className="m-0 text-[11px] text-ai-secondary">
					<span className="font-medium">Checked:</span> {reference.checked}
				</p>
			) : null}
			{hasEvidence ? (
				<ul className="m-0 flex flex-col gap-0.5 pl-3">
					{reference.evidence!.map((item, i) => (
						<li key={i} className="text-[11px] text-ai-tertiary">
							{item}
						</li>
					))}
				</ul>
			) : null}
			{hasDetail ? <p className="m-0 text-[11px] text-ai-muted">{reference.detail}</p> : null}
		</div>
	)
}

export function PillBody({
	reference,
	citedCell,
	advancedProvenance
}: {
	reference: UnifiedCitationReference
	citedCell: CitedCell | null
	advancedProvenance: boolean
}) {
	let typeBody: ReactNode
	switch (reference.sourceType) {
		case 'data':
			typeBody = <DataView reference={reference} citedCell={citedCell} advancedProvenance={advancedProvenance} />
			break
		case 'computed':
			typeBody = <ComputedView reference={reference} />
			break
		case 'web':
			typeBody = <WebView reference={reference} />
			break
		case 'x':
			typeBody = reference.url ? (
				<XView reference={reference} />
			) : (
				<DataView reference={reference} citedCell={citedCell} advancedProvenance={advancedProvenance} />
			)
			break
		case 'tool':
			typeBody = <ToolView reference={reference} />
			break
		case 'file':
			typeBody = <FileView reference={reference} citedCell={citedCell} />
			break
		default:
			typeBody = null
	}
	return (
		<>
			{typeBody}
			<FactCheckSection reference={reference} />
		</>
	)
}

function headlineFor(reference: UnifiedCitationReference): string | undefined {
	if (reference.sourceType === 'x') return xHandleLabel(reference.label) ?? reference.label
	if (reference.sourceType === 'tool') return friendlyToolName(reference)
	return reference.value ?? reference.checked ?? reference.label
}

export function CitationPill({ reference }: CitationPillProps) {
	const id = reference.id
	const hovercard = Ariakit.useHovercardStore({ placement: 'top', showTimeout: 120, hideTimeout: 180 })
	const badge = badgeFor(reference.sourceType)
	const iconName = iconFor(reference.sourceType)
	const headline = headlineFor(reference)
	const mismatch = shouldFlagMismatch(reference.verification)
	const unverified = !mismatch && shouldFlagUnverified(reference.verification)
	const citedCell = useMemo(
		() =>
			findCitedCell(reference.rows, reference.columns, {
				field: reference.field,
				rowIndex: reference.rowIndex,
				value: reference.value
			}),
		[reference.rows, reference.columns, reference.field, reference.rowIndex, reference.value]
	)
	const description = reference.sourceType === 'data' ? describeFigure(reference, citedCell) : null
	const citedRow = citedCell && reference.rows ? reference.rows[citedCell.rowIndex] : null
	const citedDate =
		reference.sourceType === 'data' && citedRow
			? citedRowDate(citedRow, reference.columns ?? Object.keys(citedRow))
			: null
	const asOfText = citedDate ?? reference.asOf
	const accent = accentFor(reference.sourceType)
	const url = openUrl(reference)
	const isLink = (reference.sourceType === 'web' || reference.sourceType === 'x') && !!url
	const markerDomain = reference.sourceType === 'web' ? domainFromUrl(reference.url) : null
	const markerHandle = reference.sourceType === 'x' ? (xHandleLabel(reference.label) ?? reference.label) : null
	const showMarkerIcon = reference.sourceType === 'web' || reference.sourceType === 'x'
	const markerText = markerDomain ?? markerHandle ?? String(id ?? '?')
	const { open } = useCitationSheet()

	return (
		<Ariakit.HovercardProvider store={hovercard}>
			<Ariakit.HovercardAnchor
				render={<button type="button" />}
				onClick={() => (isLink && url ? window.open(url, '_blank', 'noopener,noreferrer') : open(reference))}
				className="mx-px inline-flex h-[18px] max-w-[160px] cursor-pointer items-center justify-center gap-0.5 rounded-[4px] border px-1 align-baseline text-[11px] leading-none font-medium no-underline transition hover:brightness-110 focus-visible:outline-hidden"
				style={{ color: accent, borderColor: `${accent}59`, backgroundColor: `${accent}14` }}
				aria-label={headline ? `Source ${id ?? ''}: ${headline}` : `Source ${id ?? ''}`}
			>
				{showMarkerIcon ? <Icon name={iconName} height={10} width={10} className="shrink-0" /> : null}
				<span className={showMarkerIcon ? 'truncate' : ''}>{markerText}</span>
			</Ariakit.HovercardAnchor>
			<Ariakit.Hovercard
				portal
				gutter={6}
				overflowPadding={16}
				className="z-50 flex max-h-[min(70vh,var(--popover-available-height))] w-96 max-w-(--popover-available-width) min-w-[min(18rem,var(--popover-available-width))] flex-col gap-2 overflow-y-auto overscroll-contain rounded-lg border border-ai-line bg-ai-surface-card p-3 text-sm shadow-xl"
			>
				<div className="flex items-center gap-2 border-b border-ai-line pb-2">
					<span
						className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md"
						style={{ backgroundColor: `${accent}1f`, color: accent }}
					>
						<Icon name={iconName} height={11} width={11} />
					</span>
					<span className="text-[10.5px] font-semibold tracking-[0.08em] uppercase" style={{ color: accent }}>
						{badge}
					</span>
					{asOfText ? <span className="ml-auto text-[10px] text-ai-muted">as of {asOfText}</span> : null}
				</div>

				{headline ? (
					<div className="flex flex-col gap-0.5">
						<p className="m-0 text-[15px] leading-tight font-semibold text-ai-primary tabular-nums">{headline}</p>
					</div>
				) : null}

				{description ? <p className="m-0 text-[11px] leading-snug text-ai-tertiary">{description}</p> : null}

				{mismatch ? (
					<div className="flex items-start gap-1.5 text-xs text-ai-warning">
						<Icon name="alert-triangle" height={13} width={13} className="mt-px shrink-0" />
						<span>{mismatchLabel(reference)}</span>
					</div>
				) : unverified ? (
					<div className="flex items-start gap-1.5 text-xs text-ai-muted">
						<Icon name="help-circle" height={13} width={13} className="mt-px shrink-0" />
						<span>{unverifiedLabel()}</span>
					</div>
				) : null}

				{isLink ? (
					<>
						{domainFromUrl(reference.url) ? (
							<span className="text-[11px] text-ai-muted">{domainFromUrl(reference.url)}</span>
						) : null}
						{sanitizeExcerpt(reference.excerpt) ? (
							<p className="m-0 text-[11px] leading-snug text-ai-tertiary">{sanitizeExcerpt(reference.excerpt)}</p>
						) : null}
						{url ? (
							<a
								href={url}
								target="_blank"
								rel="noopener noreferrer"
								className="self-start text-[11px] font-medium text-ai-accent-blue hover:underline"
							>
								Open link ↗
							</a>
						) : null}
					</>
				) : (
					<button
						onClick={() => open(reference)}
						className="self-start text-[11px] font-medium text-ai-accent-blue hover:underline"
					>
						Click to see the source →
					</button>
				)}
			</Ariakit.Hovercard>
		</Ariakit.HovercardProvider>
	)
}
