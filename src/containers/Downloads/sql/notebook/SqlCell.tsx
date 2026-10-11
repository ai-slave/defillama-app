import MonacoEditor, { loader } from '@monaco-editor/react'
import type { Ref } from 'react'
import { useCallback, useEffect, useImperativeHandle, useRef } from 'react'
import { useDarkModeManager } from '~/contexts/LocalStorage'
import { Card } from '~/ui/Card'
import { SurfaceBodyLoadingStatus } from '~/ui/Status'
import type { ChartConfig } from '../chartConfig'
import { DARK_THEME_ID, defineSqlEditorThemes, LIGHT_THEME_ID } from '../editorTheme'
import { ErrorBanner, replaceIdentifier } from '../ErrorBanner'
import { ResultsPanel } from '../ResultsPanel'
import type { NotebookCell, ResultsView } from '../useSqlTabs'
import type { RegisteredTable } from '../useTableRegistry'

loader.config({
	paths: {
		vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.55.1/min/vs'
	}
})

export interface SqlCellHandle {
	focus: () => void
	revealLine: (line: number, column?: number) => void
}

interface SqlCellProps {
	cell: NotebookCell
	loadedTables: Array<RegisteredTable>
	onSourceChange: (next: string) => void
	onRun: () => void
	onRunAndAdvance: () => void
	onFocus: () => void
	onChartConfigChange: (next: ChartConfig | null) => void
	onViewChange: (view: ResultsView) => void
}

export function SqlCell({
	cell,
	loadedTables,
	onSourceChange,
	onRun,
	onRunAndAdvance,
	onFocus,
	onChartConfigChange,
	onViewChange,
	ref
}: SqlCellProps & { ref?: Ref<SqlCellHandle> }) {
	// The theme store, not the <html> class: the class flips in an effect after the toggle renders.
	const [isDarkMode] = useDarkModeManager()
	const theme = isDarkMode ? DARK_THEME_ID : LIGHT_THEME_ID
	const editorInstanceRef = useRef<any>(null)

	const onRunRef = useRef(onRun)
	const onRunAndAdvanceRef = useRef(onRunAndAdvance)
	useEffect(() => {
		onRunRef.current = onRun
		onRunAndAdvanceRef.current = onRunAndAdvance
	}, [onRun, onRunAndAdvance])

	useImperativeHandle(
		ref,
		() => ({
			focus: () => editorInstanceRef.current?.focus(),
			revealLine: (line: number, column?: number) => {
				const editor = editorInstanceRef.current
				if (!editor) return
				editor.revealLineInCenter(line)
				editor.setPosition({ lineNumber: line, column: column ?? 1 })
				editor.focus()
			}
		}),
		[]
	)

	const handleMount = useCallback(
		(editor: any, monaco: any) => {
			editorInstanceRef.current = editor
			editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => onRunRef.current())
			editor.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.Enter, () => onRunAndAdvanceRef.current())
			editor.onDidFocusEditorWidget(() => onFocus())
			editor.onDidDispose(() => {
				if (editorInstanceRef.current === editor) editorInstanceRef.current = null
			})
		},
		[onFocus]
	)

	const lineCount = Math.max(cell.source.split('\n').length, 3)
	const editorHeight = Math.min(Math.max(lineCount * 18 + 20, 80), 420)

	return (
		<div className="flex flex-col gap-2">
			<Card padding="none" className="overflow-hidden">
				<MonacoEditor
					height={`${editorHeight}px`}
					language="sql"
					theme={theme}
					value={cell.source}
					onChange={(v) => onSourceChange(v ?? '')}
					beforeMount={defineSqlEditorThemes}
					onMount={handleMount}
					loading={<SurfaceBodyLoadingStatus label="Loading editor" className="h-full min-h-0" />}
					options={{
						minimap: { enabled: false },
						fontSize: 13,
						tabSize: 2,
						wordWrap: 'on',
						scrollBeyondLastLine: false,
						automaticLayout: true,
						renderLineHighlight: 'line',
						padding: { top: 8, bottom: 8 },
						lineNumbers: 'on',
						lineDecorationsWidth: 6,
						lineNumbersMinChars: 3,
						fontLigatures: true,
						fontFamily:
							"'JetBrains Mono', 'SF Mono', Menlo, Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, monospace",
						quickSuggestions: { other: true, comments: false, strings: false },
						suggestOnTriggerCharacters: true,
						wordBasedSuggestions: 'currentDocument',
						acceptSuggestionOnEnter: 'on',
						tabCompletion: 'on',
						smoothScrolling: true,
						fixedOverflowWidgets: true,
						scrollbar: { vertical: 'auto', alwaysConsumeMouseWheel: false },
						guides: { indentation: false, highlightActiveIndentation: false }
					}}
				/>
			</Card>

			{cell.runError ? (
				<ErrorBanner
					error={cell.runError}
					loadedTables={loadedTables}
					density="compact"
					onJump={(line, column) => {
						const editor = editorInstanceRef.current
						if (!editor) return
						editor.revealLineInCenter(line)
						editor.setPosition({ lineNumber: line, column: column ?? 1 })
						editor.focus()
					}}
					onApplyFix={(oldId, newId) => onSourceChange(replaceIdentifier(cell.source, oldId, newId))}
				/>
			) : null}

			<ResultsPanel
				result={cell.result}
				running={cell.running}
				busyLabel={cell.loadingStage}
				chartConfig={cell.chartConfig}
				onChartConfigChange={onChartConfigChange}
				view={cell.view}
				onViewChange={onViewChange}
				durationMs={cell.lastRun?.durationMs ?? null}
			/>
		</div>
	)
}
