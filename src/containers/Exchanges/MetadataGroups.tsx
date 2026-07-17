import { useState } from 'react'
import { ExternalLinkButton } from '~/components/ExternalLinkButton'
import { Icon } from '~/components/Icon'
import { BasicLink } from '~/components/Link'
import { buttonStyles } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { Tooltip } from '~/ui/Tooltip'
import { formattedNum } from '~/utils'
import {
	formatMetadataAsOf,
	METADATA_GROUP_ORDER,
	METADATA_GROUP_PRESENTATION,
	metadataLinkIcon,
	metadataStatusTone,
	metadataValueLabel
} from './metadataPresentation'
import type {
	ExchangeMetadataCell,
	ExchangeMetadataFieldModel,
	ExchangeMetadataGroupModel,
	ExchangeMetadataScalarFormat,
	ExchangeMetadataSource,
	ExchangeMetadataTone
} from './models'

export function MetadataSource({ source }: { source: ExchangeMetadataSource | undefined }) {
	if (!source) return null
	return (
		<span className="flex flex-wrap items-center justify-end gap-1.5">
			{source.asOf ? <span className="label-sm text-tertiary">As of {formatMetadataAsOf(source.asOf)}</span> : null}
			{source.note ? (
				<Tooltip content={source.note}>
					<span
						tabIndex={0}
						role="img"
						aria-label="Source methodology note"
						className="inline-flex text-tertiary hover:text-primary focus-visible:text-primary"
					>
						<Icon name="help-circle" height={14} width={14} />
					</span>
				</Tooltip>
			) : null}
			<BasicLink
				href={source.url}
				target="_blank"
				rel="noopener noreferrer"
				className={buttonStyles({ variant: 'secondary', size: 'sm' })}
			>
				Source
				<Icon name="external-link" height={12} width={12} />
			</BasicLink>
		</span>
	)
}

const TONE_CLASSES: Record<ExchangeMetadataTone, string> = {
	positive: 'border-data-up bg-data-up/10 text-data-up',
	caution: 'border-warning bg-warning/10 text-warning',
	negative: 'border-data-down bg-data-down/10 text-data-down',
	neutral: 'border-subtle bg-surface-elevated-1 text-secondary'
}

function MetadataBadge({ value, tone = 'neutral' }: { value: string; tone?: ExchangeMetadataTone }) {
	const icon = tone === 'positive' ? 'check-circle' : tone === 'negative' ? 'circle-x' : null
	return (
		<span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 label-sm ${TONE_CLASSES[tone]}`}>
			{icon ? <Icon name={icon} height={12} width={12} /> : null}
			{metadataValueLabel(value)}
		</span>
	)
}

function MetadataPills({ values }: { values: string[] }) {
	return (
		<span className="flex flex-wrap gap-1">
			{values.map((value) => (
				<span key={value} className="rounded-md border border-subtle bg-surface-elevated-1 px-2 py-0.5 label-sm">
					{metadataValueLabel(value)}
				</span>
			))}
		</span>
	)
}

function ExternalMetadataLink({ value }: { value: { label: string; url: string } }) {
	return (
		<BasicLink
			href={value.url}
			target="_blank"
			rel="noopener noreferrer"
			className="inline-flex items-center gap-1 text-link hover:underline"
		>
			{metadataValueLabel(value.label)}
			<Icon name="external-link" height={12} width={12} />
		</BasicLink>
	)
}

function formatScalar(value: ExchangeMetadataCell | undefined, type: ExchangeMetadataScalarFormat): React.ReactNode {
	if (value == null || value === '') return <span className="text-tertiary">–</span>
	if (type === 'bool') {
		return value === true ? <MetadataBadge value="Yes" tone="positive" /> : <MetadataBadge value="No" />
	}
	if (type === 'usd' && typeof value === 'number') return formattedNum(value, true)
	if (type === 'pct' && typeof value === 'number') return `${(value * 100).toFixed(3)}%`
	if (type === 'number' && typeof value === 'number') return formattedNum(value)
	if (type === 'link' && typeof value === 'object' && !Array.isArray(value)) {
		return <ExternalMetadataLink value={value} />
	}
	if (type === 'link' && typeof value === 'string') {
		return <ExternalMetadataLink value={{ label: 'Open link', url: value }} />
	}
	if (Array.isArray(value)) return <MetadataPills values={value} />
	return typeof value === 'object' ? '–' : String(value)
}

export function MetadataFieldValue({ field }: { field: ExchangeMetadataFieldModel }) {
	if (field.type === 'links') {
		return (
			<span className="flex flex-wrap gap-2">
				{field.value.map((link) => (
					<ExternalLinkButton key={`${link.label}-${link.url}`} href={link.url} icon={metadataLinkIcon(link.label)}>
						{metadataValueLabel(link.label)}
					</ExternalLinkButton>
				))}
			</span>
		)
	}
	if (field.type === 'pills') return <MetadataPills values={field.value} />
	if (field.type === 'kv') {
		return (
			<dl className="grid gap-1.5">
				{field.value.map((item, index) => (
					<div key={`${item.label}-${index}`} className="flex justify-between gap-4">
						<dt className="text-secondary">{item.label}</dt>
						<dd className="text-right">{formatScalar(item.value, 'text')}</dd>
					</div>
				))}
			</dl>
		)
	}
	if (field.type === 'link') return <ExternalMetadataLink value={field.value} />
	if (field.type === 'badge') return <MetadataBadge value={field.value} tone={field.tone} />
	if (field.type === 'table') return <MetadataTable field={field} />
	return <>{formatScalar(field.value, field.type)}</>
}

function MetadataTableCell({
	value,
	columnKey,
	format = 'text'
}: {
	value: ExchangeMetadataCell | undefined
	columnKey: string
	format?: ExchangeMetadataScalarFormat
}) {
	if (columnKey === 'status' && typeof value === 'string') {
		return <MetadataBadge value={value} tone={metadataStatusTone(value)} />
	}
	if (columnKey === 'type' && typeof value === 'string' && ['both', 'deposit', 'withdraw'].includes(value)) {
		return <MetadataBadge value={value} />
	}
	return <>{formatScalar(value, format)}</>
}

function metadataCellHasValue(value: ExchangeMetadataCell | undefined): boolean {
	if (value == null || value === '') return false
	return !(Array.isArray(value) && value.length === 0)
}

function MetadataTable({
	field,
	rows
}: {
	field: Extract<ExchangeMetadataFieldModel, { type: 'table' }>
	rows?: Array<Record<string, ExchangeMetadataCell>>
}) {
	// Columns with no data in ANY row (not just the previewed ones) are dropped,
	// so the visible set stays stable when a preview expands.
	const columns = field.columns.filter((column) => field.value.some((row) => metadataCellHasValue(row[column.key])))
	const visibleRows = rows ?? field.value
	return (
		<div className="overflow-x-auto">
			<table className="w-full border-collapse body-sm" style={{ minWidth: `${columns.length * 120}px` }}>
				<thead>
					<tr>
						{columns.map((column) => (
							<th
								key={column.key}
								className="border-b border-subtle px-3 py-2 label-sm whitespace-nowrap text-tertiary"
								style={{ textAlign: column.align === 'right' ? 'right' : 'left' }}
							>
								{column.label}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{visibleRows.map((row, rowIndex) => (
						<tr key={rowIndex} className="hover:bg-hover-row">
							{columns.map((column) => (
								<td
									key={column.key}
									className={`border-b border-subtle px-3 py-2 ${column.align === 'right' ? 'font-jetbrains' : ''}`}
									style={{ textAlign: column.align === 'right' ? 'right' : 'left' }}
								>
									<MetadataTableCell value={row[column.key]} columnKey={column.key} format={column.format} />
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	)
}

function isSameMetadataSource(a: ExchangeMetadataSource | undefined, b: ExchangeMetadataSource | undefined): boolean {
	return !!a && !!b && a.url === b.url && a.asOf === b.asOf && a.note === b.note
}

const TABLE_PREVIEW_ROWS = 4

function MetadataTableField({
	field,
	group
}: {
	field: Extract<ExchangeMetadataFieldModel, { type: 'table' }>
	group: ExchangeMetadataGroupModel
}) {
	const [expanded, setExpanded] = useState(false)
	const previewable = field.key.endsWith('_vip') && field.value.length > TABLE_PREVIEW_ROWS
	const rows = previewable && !expanded ? field.value.slice(0, TABLE_PREVIEW_ROWS) : field.value
	const hideLabel =
		field.label.toLowerCase() === METADATA_GROUP_PRESENTATION[group.key].title.toLowerCase() ||
		field.label.toLowerCase() === group.title.toLowerCase()
	const source = isSameMetadataSource(field.source, group.source) ? undefined : field.source
	return (
		<div className="border-b border-subtle sm:col-span-2">
			{hideLabel && !source ? null : (
				<div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
					{hideLabel ? null : <h3 className="label-md">{field.label}</h3>}
					<span className="ml-auto">
						<MetadataSource source={source} />
					</span>
				</div>
			)}
			<MetadataTable field={field} rows={rows} />
			{previewable ? (
				<button
					type="button"
					aria-expanded={expanded}
					onClick={() => setExpanded((value) => !value)}
					className="flex w-full items-center justify-center gap-1 px-3 py-2 label-sm text-link hover:bg-hover-row"
				>
					{expanded ? 'Show fewer tiers' : `Show all ${field.value.length} tiers`}
					<Icon
						name="chevron-down"
						height={14}
						width={14}
						className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
					/>
				</button>
			) : null}
		</div>
	)
}

function MetadataScalarField({
	field,
	group,
	isDescription,
	secondColumn,
	startsRow
}: {
	field: Exclude<ExchangeMetadataFieldModel, { type: 'table' }>
	group: ExchangeMetadataGroupModel
	isDescription: boolean
	secondColumn: boolean
	startsRow: boolean
}) {
	const source = isSameMetadataSource(field.source, group.source) ? undefined : field.source
	return (
		<div
			className={`min-w-0 border-b border-subtle p-3 ${isDescription ? 'sm:col-span-2' : ''} ${
				secondColumn ? 'sm:border-l' : ''
			} ${startsRow ? 'sm:col-start-1' : ''}`}
		>
			<div className="flex flex-wrap items-start justify-between gap-2">
				{isDescription ? null : <span className="label-sm text-tertiary">{field.label}</span>}
				<MetadataSource source={source} />
			</div>
			<div className={`${isDescription ? 'max-w-5xl text-secondary' : 'mt-1'} body-md`}>
				<MetadataFieldValue field={field} />
			</div>
		</div>
	)
}

function MetadataFields({ group, singleColumn }: { group: ExchangeMetadataGroupModel; singleColumn?: boolean }) {
	// Fields auto-flow into a two-column grid; tables and the description span both
	// columns, so the column a scalar lands in is deterministic from render order.
	let column = 0
	return (
		<div className={`grid grid-cols-1 ${singleColumn ? '' : 'sm:grid-cols-2'}`}>
			{group.fields.map((field) => {
				if (field.type === 'table') {
					column = 0
					return <MetadataTableField key={field.key} field={field} group={group} />
				}
				const isDescription = group.key === 'identity' && field.key === 'description'
				// Maker/taker fee pairs must read side by side, so a maker field that
				// would land in the second column breaks onto a fresh row instead.
				const startsRow = !singleColumn && column === 1 && field.key.endsWith('_maker')
				if (startsRow) column = 0
				const secondColumn = !singleColumn && !isDescription && column === 1
				column = isDescription || singleColumn ? 0 : column === 1 ? 0 : 1
				return (
					<MetadataScalarField
						key={field.key}
						field={field}
						group={group}
						isDescription={isDescription}
						secondColumn={secondColumn}
						startsRow={startsRow}
					/>
				)
			})}
		</div>
	)
}

function MetadataGroupHeader({ group }: { group: ExchangeMetadataGroupModel }) {
	const presentation = METADATA_GROUP_PRESENTATION[group.key]
	return (
		<div className="flex flex-wrap items-center gap-2 border-b border-subtle px-3 py-2.5">
			<span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-muted text-link">
				<Icon name={presentation.icon} height={17} width={17} />
			</span>
			<h2 className="label-lg">{presentation.title}</h2>
			{group.fromProofOfReserves ? (
				<span className="rounded-md border border-data-up bg-data-up/10 px-2 py-0.5 label-sm text-data-up">
					Live reserves data
				</span>
			) : null}
			<span className="ml-auto">
				<MetadataSource source={group.source} />
			</span>
		</div>
	)
}

function MetadataGroup({
	group,
	nestedGroup,
	singleColumn
}: {
	group: ExchangeMetadataGroupModel
	nestedGroup?: ExchangeMetadataGroupModel
	singleColumn?: boolean
}) {
	return (
		<Card as="section" padding="none" className="overflow-hidden">
			<MetadataGroupHeader group={group} />
			<MetadataFields group={group} singleColumn={singleColumn} />
			{nestedGroup ? (
				<>
					<div className="flex flex-wrap items-center gap-2 border-b border-subtle px-3 py-2.5">
						<Icon name="link" height={15} width={15} className="text-link" />
						<h3 className="label-md">Links & platforms</h3>
						<span className="ml-auto">
							<MetadataSource source={nestedGroup.source} />
						</span>
					</div>
					<MetadataFields group={nestedGroup} />
				</>
			) : null}
		</Card>
	)
}

export function hasExchangeInformation(groups: ExchangeMetadataGroupModel[]): boolean {
	return groups.some((group) => group.key !== 'metrics')
}

/** Compact groups (no tables) can share a row instead of each taking a mostly-empty full-width card. */
function isCompactGroup(group: ExchangeMetadataGroupModel): boolean {
	return group.fields.every((field) => field.type !== 'table')
}

export function MetadataGroups({ groups }: { groups: ExchangeMetadataGroupModel[] }) {
	const groupsByKey = new Map(groups.map((group) => [group.key, group]))
	const overview = groupsByKey.get('identity')
	const links = groupsByKey.get('links')
	const rest: ExchangeMetadataGroupModel[] = []
	for (const key of METADATA_GROUP_ORDER) {
		if (key === 'identity' || key === 'links') continue
		const group = groupsByKey.get(key)
		if (group) rest.push(group)
	}

	if (!overview && !links && rest.length === 0) return null

	const rows: ExchangeMetadataGroupModel[][] = []
	for (const group of rest) {
		const previous = rows[rows.length - 1]
		if (previous?.length === 1 && isCompactGroup(previous[0]) && isCompactGroup(group)) previous.push(group)
		else rows.push([group])
	}

	return (
		<section className="flex flex-col gap-2" aria-label="Exchange information">
			{overview ? (
				<MetadataGroup group={overview} nestedGroup={links} />
			) : links ? (
				<MetadataGroup group={links} />
			) : null}
			{rows.map((row) =>
				row.length === 2 ? (
					<div key={row[0].key} className="grid grid-cols-1 gap-2 xl:grid-cols-2">
						{row.map((group) => (
							<MetadataGroup key={group.key} group={group} singleColumn={group.fields.length === 1} />
						))}
					</div>
				) : (
					<MetadataGroup key={row[0].key} group={row[0]} singleColumn={row[0].fields.length === 1} />
				)
			)}
		</section>
	)
}
