import { useMemo, useRef } from 'react'
import { ChartRouter } from '~/containers/Downloads/sql/chart'
import { ChartToolbar } from '~/containers/Downloads/sql/chart/ChartToolbar'
import { type ChartConfig as DownloadChartConfig, defaultChartConfig } from '~/containers/Downloads/sql/chartConfig'
import { classifyColumns } from '~/containers/Downloads/sql/columnKind'
import type { QueryResult } from '~/containers/Downloads/sql/exportResults'
import { ResultsGrid } from '~/containers/Downloads/sql/ResultsGrid'
import { useDebouncedCallback } from '~/hooks/useDebounce'
import { Card } from '~/ui/Card'
import { Field } from '~/ui/Field'
import { FileButton } from '~/ui/FileButton'
import { Icon } from '~/ui/Icon'
import { Input, Textarea } from '~/ui/Input'
import { MetaLine } from '~/ui/MetaLine'
import { SegmentedControl, type SegmentedControlOption } from '~/ui/SegmentedControl'
import { trackUmamiEvent } from '~/utils/analytics/umami'
import type { CustomDataRows, SqlSnapshotValue } from '../../types'
import { assertCustomDataSizeAllowed, CustomDataParseError, parseCustomDataCsv } from '../CustomData/parseCustomDataCsv'
import { CustomDataTooLargeError, encodeRows, useDecodedRows } from '../CustomData/rowsEncoding'
import { PremiumFeatureGate } from '../PremiumFeatureGate'
import { ADD_CARD_PANES, type AddCardPane } from './panes'
import type { CustomDataModalState } from './types'

export const TYPED_CSV_PARSE_DELAY_MS = 300

const DISPLAY_MODE_OPTIONS: Array<SegmentedControlOption<CustomDataModalState['displayMode']>> = [
	{
		value: 'chart',
		label: (
			<span className="flex items-center gap-1.5">
				<Icon name="bar-chart-2" className="size-3" />
				Chart
			</span>
		)
	},
	{
		value: 'table',
		label: (
			<span className="flex items-center gap-1.5">
				<Icon name="align-left" className="size-3" />
				Table
			</span>
		)
	}
]

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
	/** What Add still needs (a CSV), shown under the CSV fields once Add was pressed. */
	error: string | null
	/** Below lg the form shows one pane; AddChartModal holds it, so a failed Add can bring back the pane with the error. */
	pane: AddCardPane
	onPaneChange: (pane: AddCardPane) => void
}

function describeError(error: unknown): string {
	if (error instanceof CustomDataParseError || error instanceof CustomDataTooLargeError) return error.message
	return "Couldn't read this CSV."
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
	onDisplayModeChange,
	error: submitError,
	pane,
	onPaneChange
}: CustomDataTabProps) {
	const encodeToken = useRef(0)
	// A CSV that does not parse says so as it is read; a missing one waits for Add. No parse error is '', not null.
	const csvError = customData.error || submitError
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

	const handleFile = (file: File) => {
		applyTypedCsv.cancel()
		try {
			assertCustomDataSizeAllowed(file.size)
		} catch (error) {
			onError(describeError(error))
			return
		}
		// A read that finishes after a later edit or file belongs to the earlier input and is dropped.
		const token = encodeToken.current + 1
		encodeToken.current = token
		const reader = new FileReader()
		reader.addEventListener('error', () => {
			if (encodeToken.current === token) onError('Could not read this file.')
		})
		reader.addEventListener('load', () => {
			if (encodeToken.current !== token) return
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
				onValueChange={onPaneChange}
				variant="solid-responsive"
				size="md"
				className="shrink-0 lg:hidden"
			/>
			<div
				className={`min-h-0 flex-col gap-3 overflow-y-auto max-lg:flex-1 lg:flex ${pane === 'configure' ? 'flex' : 'hidden'}`}
			>
				<Field label="Card name (optional)">
					{(control) => (
						<Input
							{...control}
							type="text"
							value={customData.name}
							onChange={(event) => onNameChange(event.target.value)}
							maxLength={80}
							className="w-full"
						/>
					)}
				</Field>

				{/* A file or a paste fills one CSV, so the paste field's error, last in the column, answers for both. */}
				{/* A CSV dropped anywhere in the column loads like a picked one, as the native file box allowed. */}
				<div
					className="flex min-h-0 flex-1 flex-col gap-3"
					onDragOver={(event) => {
						if (event.dataTransfer.types.includes('Files')) event.preventDefault()
					}}
					onDrop={(event) => {
						const file = event.dataTransfer.files[0]
						if (!file) return
						event.preventDefault()
						handleFile(file)
					}}
				>
					<FileButton
						accept=".csv,text/csv"
						size="md"
						data-umami-event="custom-data-file"
						onFiles={([file]) => handleFile(file)}
						className="self-start"
					>
						<Icon name="paperclip" className="size-3.5" aria-hidden />
						Upload CSV file
					</FileButton>

					<Field label="Or paste CSV" error={csvError} className="min-h-0 flex-1">
						{(control) => (
							<Textarea
								{...control}
								value={customData.csvText}
								onChange={(event) => handleTextChange(event.target.value)}
								placeholder={'date,value\n2026-01-01,10'}
								variant="code"
								className="min-h-[160px] w-full flex-1 resize-none"
							/>
						)}
					</Field>
				</div>
				{customData.sourceName ? (
					<p className="truncate body-sm text-tertiary">Source: {customData.sourceName}</p>
				) : null}
			</div>

			<div
				className={`min-h-0 flex-col gap-2 overflow-y-auto max-lg:flex-1 lg:flex ${pane === 'preview' ? 'flex' : 'hidden'}`}
			>
				<div className="flex shrink-0 items-center gap-2">
					<SegmentedControl
						label="Display as"
						variant="default"
						size="sm"
						value={customData.displayMode}
						onValueChange={(mode) => {
							trackUmamiEvent(`custom-data-display-${mode}`)
							onDisplayModeChange(mode)
						}}
						options={DISPLAY_MODE_OPTIONS}
					/>
					{result ? (
						<MetaLine>
							{`${result.rows.length} ${result.rows.length === 1 ? 'row' : 'rows'}`}
							{`${result.columns.length} columns`}
						</MetaLine>
					) : null}
				</div>

				{result && customData.displayMode === 'chart' && hasNumeric ? (
					<div className="shrink-0">
						<ChartToolbar config={customData.chart} classified={classified} onChange={onChartChange} />
					</div>
				) : null}

				<Card padding="sm" className="min-h-[260px] flex-1 overflow-hidden">
					{!result ? (
						<div className="flex h-full items-center justify-center px-6 text-center body-sm text-tertiary">
							Paste or upload a CSV to preview it here.
						</div>
					) : customData.displayMode === 'table' ? (
						<div className="h-full min-h-0">
							<ResultsGrid result={result} />
						</div>
					) : !hasNumeric ? (
						<div className="flex h-full items-center justify-center px-6 text-center body-sm text-tertiary">
							No numeric columns in this dataset to chart.
						</div>
					) : (
						<ChartRouter config={customData.chart} result={result} classified={classified} />
					)}
				</Card>
			</div>
		</div>
	)
}
