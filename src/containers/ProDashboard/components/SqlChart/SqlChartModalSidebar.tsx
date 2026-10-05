import { useState, type Dispatch, type SetStateAction } from 'react'
import type { ChartOptionsMap } from '~/containers/Downloads/chart-datasets'
import type { QuerySavedConfig } from '~/containers/Downloads/savedDownloads'
import { DUCKDB_DOCS_URL } from '~/containers/Downloads/sql/dialectDocs'
import { CookbookTab, ShortcutsTab } from '~/containers/Downloads/sql/DocsPanel'
import type { ExampleQuery } from '~/containers/Downloads/sql/examples'
import { ExamplesPanel } from '~/containers/Downloads/sql/ExamplesPanel'
import { SchemaBrowser } from '~/containers/Downloads/sql/SchemaBrowser'
import type { RegisteredTable, TableLoadError, TableSource } from '~/containers/Downloads/sql/useTableRegistry'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { Tabs, TabPanel } from '~/ui/Tabs'
import { SavedQueriesPanel } from './SavedQueriesPanel'

const TABS = [
	{ value: 'examples', label: 'Examples' },
	{ value: 'schema', label: 'Schema' },
	{ value: 'cookbook', label: 'Cookbook' },
	{ value: 'saved', label: 'Saved' },
	{ value: 'shortcuts', label: 'Shortcuts' }
] as const
type TabId = (typeof TABS)[number]['value']

interface SqlChartModalSidebarProps {
	chartOptionsMap: ChartOptionsMap
	loadedTables: Array<RegisteredTable>
	onLoadTable: (source: TableSource) => Promise<RegisteredTable | null>
	schemaLoading: string | null
	schemaError: TableLoadError | null
	schemaParams: Record<string, string>
	setSchemaParams: Dispatch<SetStateAction<Record<string, string>>>
	busyTaskId: string | null
	savedQueries: Array<QuerySavedConfig>
	onApplyExample: (example: ExampleQuery) => void
	onApplySaved: (query: QuerySavedConfig) => void
	onReplaceSql: (snippet: string) => void
	onInsertAtCursor: (text: string) => void
	onApplyAndRun: (sql: string) => void
}

export function SqlChartModalSidebar({
	chartOptionsMap,
	loadedTables,
	onLoadTable,
	schemaLoading,
	schemaError,
	schemaParams,
	setSchemaParams,
	busyTaskId,
	savedQueries,
	onApplyExample,
	onApplySaved,
	onReplaceSql,
	onInsertAtCursor,
	onApplyAndRun
}: SqlChartModalSidebarProps) {
	const [tab, setTab] = useState<TabId>('examples')

	return (
		<aside className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-md border border-medium bg-surface">
			<Tabs<TabId> value={tab} onValueChange={setTab} values={TABS.map((item) => item.value)}>
				<div className="shrink-0 border-b border-subtle p-2">
					<SegmentedControl
						semantics="tabs"
						label="SQL reference section"
						variant="default"
						size="md"
						options={TABS.map((option) =>
							option.value === 'saved' && savedQueries.length > 0
								? {
										...option,
										label: (
											<>
												Saved <span className="text-tertiary tabular-nums">{savedQueries.length}</span>
											</>
										)
									}
								: option
						)}
					/>
				</div>

				<TabPanel value={tab} className="min-h-0 flex-1 overflow-y-auto p-3">
					{tab === 'examples' ? (
						<ExamplesPanel onApply={onApplyExample} busyTaskId={busyTaskId} />
					) : tab === 'schema' ? (
						<SchemaBrowser
							chartOptionsMap={chartOptionsMap}
							loadedTables={loadedTables}
							onLoad={onLoadTable}
							onReplaceSql={onReplaceSql}
							onInsertAtCursor={onInsertAtCursor}
							loading={schemaLoading}
							loadError={schemaError}
							pickedParams={schemaParams}
							setPickedParams={setSchemaParams}
						/>
					) : tab === 'cookbook' ? (
						<CookbookTab onApplyAndRun={onApplyAndRun} />
					) : tab === 'shortcuts' ? (
						<ShortcutsTab />
					) : (
						<SavedQueriesPanel queries={savedQueries} busyTaskId={busyTaskId} onApply={onApplySaved} />
					)}
				</TabPanel>
			</Tabs>

			<footer className="shrink-0 border-t border-subtle px-3 py-2">
				<a href={DUCKDB_DOCS_URL} target="_blank" rel="noreferrer" className="label-sm text-link hover:underline">
					LlamaSQL dialect docs ↗
				</a>
			</footer>
		</aside>
	)
}
