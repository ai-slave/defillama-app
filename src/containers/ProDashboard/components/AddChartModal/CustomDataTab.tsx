import { useMemo, useRef, useState } from 'react'
import { ChartRouter } from '~/containers/Downloads/sql/chart'
import { ChartToolbar } from '~/containers/Downloads/sql/chart/ChartToolbar'
import { type ChartConfig as DownloadChartConfig, defaultChartConfig } from '~/containers/Downloads/sql/chartConfig'
import { classifyColumns } from '~/containers/Downloads/sql/columnKind'
import type { QueryResult } from '~/containers/Downloads/sql/exportResults'
import { ResultsGrid } from '~/containers/Downloads/sql/ResultsGrid'
import { useDebouncedCallback } from '~/hooks/useDebounce'
import { Icon } from '~/ui/Icon'
import { SegmentedControl } from '~/ui/SegmentedControl'
import type { CustomDataRows, SqlSnapshotValue } from '../../types'
import { assertCustomDataSizeAllowed, CustomDataParseError, parseCustomDataCsv } from '../CustomData/parseCustomDataCsv'
import { CustomDataTooLargeError, encodeRows, useDecodedRows } from '../CustomData/rowsEncoding'
import { PremiumFeatureGate } from '../PremiumFeatureGate'
import { ADD_CARD_PANES, type AddCardPane } from './panes'
import type { CustomDataModalState } from './types'

export const TYPED_CSV_PARSE_DELAY_MS = 300

interface CustomDataTabProps {
	customData: CustomDataModalState
	onNameChange: (name: string) => void
	onTextChange: (text: string) => void
	onParsed: (payload: {
		columns: Array<{ name: string; type: string }>
		rows: Array<Array<SqlSnapshotValue>>
		chart: DownloadChartConfig
		sourceName: string
	}) => void
	onStoredRowsChange: (rows: CustomDataRows | null) => void
	onError: (message: string) => void
	onChartChange: (patch: Partial<DownloadChartConfig>) => void
	onDisplayModeChange: (mode: 'chart' | 'table') => void
}

function describeError(error: unknown): string {
	if (error instanceof CustomDataParseError || error instanceof CustomDataTooLargeError) return error.message
	if (error instanceof Error && error.message) return error.message
	return 'Could not read this CSV.'
}

export function CustomDataTab(props: CustomDataTabProps) {
	return (
		<PremiumFeatureGate featureName="Custom data" paywallReason="pro-feature">
			<CustomDataForm {...props} />
		</PremiumFeatureGate>
	)
}

function CustomDataForm({
	customData,
	onNameChange,
	onTextChange,
	onParsed,
	onStoredRowsChange,
	onError,
	onChartChange,
	onDisplayModeChange
}: CustomDataTabProps) {
	const encodeToken = useRef(0)
	const [pane, setPane] = useState<AddCardPane>('configure')
	// A fresh CSV preview replaces the stored rows, so those only decode while there is no preview.
	const stored = useDecodedRows(customData.previewRows || !customData.storedRows ? undefined : customData.storedRows)
	const rows = customData.previewRows ?? (stored.status === 'ready' ? stored.rows : null)

	const result = useMemo<QueryResult | null>(
		() => (rows ? { columns: customData.columns, rows } : null),
		[rows, customData.columns]
	)
	const classified = useMemo(() => (result ? classifyColumns(result) : []), [result])
	const hasNumeric = classified.some((column) => column.coarse === 'number')

	const applyCsv = (text: string, sourceName: string) => {
		const token = encodeToken.current + 1
		encodeToken.current = token
		let parsed
		try {
			assertCustomDataSizeAllowed(text.length)
			parsed = parseCustomDataCsv(text)
		} catch (error) {
			onError(describeError(error))
			return
		}
		onParsed({
			columns: parsed.columns,
			rows: parsed.rows,
			chart: defaultChartConfig(classifyColumns(parsed.result)),
			sourceName
		})
		encodeRows(parsed.rows).then(
			(encoded) => {
				if (encodeToken.current === token) onStoredRowsChange(encoded)
			},
			(error: unknown) => {
				if (encodeToken.current === token) onError(describeError(error))
			}
		)
	}

	const applyTypedCsv = useDebouncedCallback(applyCsv, TYPED_CSV_PARSE_DELAY_MS)

	const handleTextChange = (text: string) => {
		// Rows still encoding belong to the text before this edit; they must not land as the stored rows.
		encodeToken.current += 1
		onTextChange(text)
		if (!text.trim()) {
			applyTypedCsv.cancel()
			onStoredRowsChange(null)
			return
		}
		applyTypedCsv(text, customData.sourceName)
	}

	const handleFile = (file: File | undefined) => {
		if (!file) return
		applyTypedCsv.cancel()
		try {
			assertCustomDataSizeAllowed(file.size)
		} catch (error) {
			onError(describeError(error))
			return
		}
		const reader = new FileReader()
		reader.addEventListener('error', () => onError('Could not read this file.'))
		reader.addEventListener('load', () => {
			const text = typeof reader.result === 'string' ? reader.result : ''
			onTextChange(text)
			applyCsv(text, file.name)
		})
		reader.readAsText(file)
	}

	return (
		<div className="flex h-full min-h-0 flex-col gap-3 lg:grid lg:grid-cols-2 lg:gap-4">
			<SegmentedControl<AddCardPane>
				label="Editor view"
				options={ADD_CARD_PANES}
				value={pane}
				onValueChange={setPane}
				variant="solid-responsive"
				size="md"
				className="shrink-0 lg:hidden"
			/>
			<div
				className={`min-h-0 flex-col gap-3 overflow-y-auto max-lg:flex-1 lg:flex ${pane === 'configure' ? 'flex' : 'hidden'}`}
			>
				<label className="flex flex-col gap-1">
					<span className="text-xs font-medium text-pro-text-secondary">Card name (optional)</span>
					<input
						type="text"
						value={customData.name}
						onChange={(event) => onNameChange(event.target.value)}
						maxLength={80}
						className="w-full rounded-sm border border-pro-cards-border bg-surface-elevated-1 px-2 py-1.5 text-xs text-pro-text-primary placeholder:text-pro-text-tertiary focus:ring-1 focus:ring-brand focus:outline-hidden"
					/>
				</label>

				<label className="flex flex-col gap-1">
					<span className="text-xs font-medium text-pro-text-secondary">CSV file</span>
					<input
						type="file"
						accept=".csv,text/csv"
						data-umami-event="custom-data-file"
						onChange={(event) => handleFile(event.target.files?.[0])}
						className="w-full rounded-sm border border-pro-cards-border bg-surface-elevated-1 px-2 py-1.5 text-xs text-pro-text-primary file:mr-2 file:rounded-sm file:border-0 file:bg-pro-cards-bg file:px-2 file:py-1 file:text-xs file:text-pro-text-primary"
					/>
				</label>

				<label className="flex min-h-0 flex-1 flex-col gap-1">
					<span className="text-xs font-medium text-pro-text-secondary">Or paste CSV</span>
					<textarea
						value={customData.csvText}
						onChange={(event) => handleTextChange(event.target.value)}
						placeholder={'date,value\n2026-01-01,10'}
						aria-label="Paste CSV"
						className="min-h-[160px] w-full flex-1 resize-none rounded-sm border border-pro-cards-border bg-surface-elevated-1 px-2 py-1.5 font-mono text-xs text-pro-text-primary placeholder:text-pro-text-tertiary focus:ring-1 focus:ring-brand focus:outline-hidden"
					/>
				</label>

				{customData.error ? <p className="text-xs text-error">{customData.error}</p> : null}
				{customData.sourceName ? (
					<p className="truncate text-xs text-pro-text-tertiary">Source: {customData.sourceName}</p>
				) : null}
			</div>

			<div
				className={`min-h-0 flex-col gap-2 overflow-y-auto max-lg:flex-1 lg:flex ${pane === 'preview' ? 'flex' : 'hidden'}`}
			>
				<div className="flex shrink-0 items-center gap-2">
					<div className="flex rounded-lg border border-pro-cards-border p-0.5">
						<button
							type="button"
							onClick={() => onDisplayModeChange('chart')}
							aria-pressed={customData.displayMode === 'chart'}
							data-umami-event="custom-data-display-chart"
							className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
								customData.displayMode === 'chart'
									? 'bg-pro-accent text-on-brand'
									: 'text-pro-text-secondary hover:text-pro-text-primary'
							}`}
						>
							<Icon name="bar-chart-2" height={12} width={12} />
							Chart
						</button>
						<button
							type="button"
							onClick={() => onDisplayModeChange('table')}
							aria-pressed={customData.displayMode === 'table'}
							data-umami-event="custom-data-display-table"
							className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
								customData.displayMode === 'table'
									? 'bg-pro-accent text-on-brand'
									: 'text-pro-text-secondary hover:text-pro-text-primary'
							}`}
						>
							<Icon name="align-left" height={12} width={12} />
							Table
						</button>
					</div>
					{result ? (
						<span className="text-xs text-pro-text-tertiary">
							{result.rows.length} {result.rows.length === 1 ? 'row' : 'rows'} · {result.columns.length} columns
						</span>
					) : null}
				</div>

				{result && customData.displayMode === 'chart' && hasNumeric ? (
					<div className="shrink-0">
						<ChartToolbar config={customData.chart} classified={classified} onChange={onChartChange} />
					</div>
				) : null}

				<div className="min-h-[260px] flex-1 overflow-hidden rounded-lg border border-pro-cards-border bg-pro-cards-bg p-2">
					{!result ? (
						<div className="flex h-full items-center justify-center px-6 text-center text-xs text-pro-text-tertiary">
							Paste or upload a CSV to preview it here.
						</div>
					) : customData.displayMode === 'table' ? (
						<div className="h-full min-h-0">
							<ResultsGrid result={result} />
						</div>
					) : !hasNumeric ? (
						<div className="flex h-full items-center justify-center px-6 text-center text-xs text-pro-text-tertiary">
							No numeric columns in this dataset to chart.
						</div>
					) : (
						<ChartRouter config={customData.chart} result={result} classified={classified} />
					)}
				</div>
			</div>
		</div>
	)
}
