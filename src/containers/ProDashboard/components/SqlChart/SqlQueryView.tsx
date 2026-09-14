import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import type { QueryInput } from '~/containers/Downloads/savedDownloads'
import { tableNameFor, type RegisteredTable } from '~/containers/Downloads/sql/useTableRegistry'
import { buildShareUrl } from '~/containers/Downloads/urlState'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { LoadingSpinner } from '~/ui/Loaders'
import { formatNumber } from '~/utils/numberFormat'
import type { SqlChartConfig, SqlSnapshot } from '../../types'

const ReadOnlySqlEditor = lazy(() =>
	import('~/containers/Downloads/sql/Editor').then((module) => ({ default: module.Editor }))
)

const EMPTY_TABLES: Array<RegisteredTable> = []
const noop = () => undefined

export function buildSqlStudioHref(config: SqlChartConfig): string {
	const query: QueryInput = {
		kind: 'query',
		sql: config.query.sql,
		tables: config.query.tableSources,
		chartConfig: config.chart
	}
	const href = buildShareUrl('', '/downloads', query)
	return `${href}${href.includes('?') ? '&' : '?'}mode=sql`
}

interface SqlQueryViewProps {
	config: SqlChartConfig
	snapshot: SqlSnapshot | null
}

export function SqlQueryView({ config, snapshot }: SqlQueryViewProps) {
	const [copied, setCopied] = useState(false)
	const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	useEffect(
		() => () => {
			if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current)
		},
		[]
	)

	const copySql = useCallback(() => {
		if (typeof navigator === 'undefined' || !navigator.clipboard) return
		navigator.clipboard.writeText(config.query.sql).then(
			() => {
				setCopied(true)
				if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current)
				copiedTimerRef.current = setTimeout(() => setCopied(false), 1500)
			},
			() => undefined
		)
	}, [config.query.sql])

	const sourceNames = config.query.tableSources.map(tableNameFor)
	const rowSummary = snapshot
		? snapshot.truncated
			? `${formatNumber(snapshot.rows.length)} of ${formatNumber(snapshot.rowCount)} rows stored`
			: `${formatNumber(snapshot.rowCount)} rows`
		: 'No result snapshot'

	return (
		<div className="flex flex-col gap-2">
			<div className="flex flex-wrap items-center justify-between gap-2">
				{sourceNames.length > 0 ? (
					<div className="flex min-w-0 flex-wrap items-center gap-1.5">
						<span className="body-xs text-pro-text-tertiary">Sources</span>
						{sourceNames.map((source) => (
							<span
								key={source}
								className="rounded-sm border border-pro-cards-border bg-page px-1.5 py-0.5 mono-sm text-pro-text-secondary"
							>
								{source}
							</span>
						))}
					</div>
				) : (
					<span className="body-xs text-pro-text-tertiary">No registered data sources</span>
				)}
				<div className="flex shrink-0 items-center gap-2">
					<Button type="button" size="sm" onClick={copySql}>
						<Icon name={copied ? 'check' : 'copy'} className="size-3" />
						{copied ? 'Copied' : 'Copy SQL'}
					</Button>
					<Button as="a" variant="primary" size="sm" href={buildSqlStudioHref(config)} target="_blank" rel="noreferrer">
						Open in SQL Studio
						<Icon name="external-link" className="size-3" />
					</Button>
				</div>
			</div>

			<div className="min-h-[180px]">
				<Suspense
					fallback={
						<div className="flex min-h-[180px] items-center justify-center rounded-sm border border-pro-cards-border bg-surface">
							<LoadingSpinner size={16} />
						</div>
					}
				>
					<ReadOnlySqlEditor
						value={config.query.sql}
						onChange={noop}
						onRun={noop}
						tables={EMPTY_TABLES}
						height={180}
						readOnly
						fitContentHeight
					/>
				</Suspense>
			</div>

			<div className="flex flex-wrap items-center gap-x-2 gap-y-1 body-xs text-pro-text-tertiary">
				<span>{rowSummary}</span>
				{snapshot ? <span>{formatNumber(snapshot.columns.length)} columns</span> : null}
				{snapshot ? <span>{snapshot.engine === 'server' ? 'Server result' : 'Browser result'}</span> : null}
			</div>
		</div>
	)
}
