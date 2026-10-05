// @vitest-environment happy-dom

import { act, useReducer } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { installSubscriberSession, type SessionAccount } from '~/utils/testing/subscriberSession'
import type { CustomDataConfig } from '../../../types'
import { CustomDataTab, TYPED_CSV_PARSE_DELAY_MS } from '../CustomDataTab'
import { initializeFromEditItem, modalReducer } from '../modalReducer'
import type { ModalState } from '../types'

vi.mock('next/router', () => ({ useRouter: () => ({ pathname: '/pro/test', query: {}, push: vi.fn() }) }))
// The SQL results grid, chart and toolbar are heavy children; these tests read the rows and columns they receive.
vi.mock('~/containers/Downloads/sql/ResultsGrid', () => ({
	ResultsGrid: ({ result }: { result: { rows: Array<unknown> } }) => <p>grid rows: {result.rows.length}</p>
}))
vi.mock('~/containers/Downloads/sql/chart', () => ({
	ChartRouter: ({ config, result }: { config: { chartType: string }; result: { rows: Array<unknown> } }) => (
		<p>
			chart {config.chartType}: {result.rows.length}
		</p>
	)
}))
vi.mock('~/containers/Downloads/sql/chart/ChartToolbar', () => ({
	ChartToolbar: ({ config }: { config: { xCol: string | null } }) => <p>x axis: {config.xCol}</p>
}))

declare global {
	var IS_REACT_ACT_ENVIRONMENT: boolean
}

const CSV = 'day,value\n2026-01-01,10\n2026-01-02,20'

let container: HTMLDivElement
let root: Root
let session: ReturnType<typeof installSubscriberSession>
function signInAs(account: SessionAccount) {
	const installed = installSubscriberSession('u1', { account, resolved: true })
	beforeEach(() => {
		session = installed
	})
}
const renderTab = (editItem: CustomDataConfig | null = null) =>
	act(async () =>
		root.render(
			<session.Wrapper>
				<Harness editItem={editItem} />
			</session.Wrapper>
		)
	)
let latest: ModalState | null = null
let parsedCount = 0

function Harness({ editItem = null }: { editItem?: CustomDataConfig | null }) {
	const [state, dispatch] = useReducer(modalReducer, editItem, initializeFromEditItem)
	latest = state
	return (
		<CustomDataTab
			customData={state.customData}
			onNameChange={(name) => dispatch({ type: 'SET_CUSTOM_DATA_NAME', payload: name })}
			onTextChange={(text) => dispatch({ type: 'SET_CUSTOM_DATA_TEXT', payload: text })}
			onParsed={(payload) => {
				parsedCount += 1
				dispatch({ type: 'SET_CUSTOM_DATA_PARSED', payload })
			}}
			onStoredRowsChange={(rows) => dispatch({ type: 'SET_CUSTOM_DATA_STORED_ROWS', payload: rows })}
			onError={(message) => dispatch({ type: 'SET_CUSTOM_DATA_ERROR', payload: message })}
			onChartChange={(patch) => dispatch({ type: 'SET_CUSTOM_DATA_CHART', payload: patch })}
			onDisplayModeChange={(mode) => dispatch({ type: 'SET_CUSTOM_DATA_DISPLAY_MODE', payload: mode })}
		/>
	)
}

async function typeCsv(text: string) {
	const textarea = document.querySelector<HTMLTextAreaElement>('textarea')
	if (!textarea) throw new Error('Expected the CSV textarea')
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, text)
		textarea.dispatchEvent(new Event('input', { bubbles: true }))
	})
}

async function waitForTypedParse() {
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, TYPED_CSV_PARSE_DELAY_MS + 20))
	})
}

async function pasteCsv(text: string) {
	await typeCsv(text)
	await waitForTypedParse()
}

function displayMode(label: string) {
	const option = Array.from(document.querySelectorAll('[role="radiogroup"][aria-label="Display as"] label')).find(
		(node) => node.textContent?.trim() === label
	)
	if (!option) throw new Error(`Expected a "${label}" display option`)
	return option.querySelector<HTMLInputElement>('input[type="radio"]')!
}

beforeEach(async () => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	latest = null
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	vi.unstubAllGlobals()
})

describe('a subscriber', () => {
	signInAs('subscriber')

	test('pasted CSV previews an auto-selected chart, switches to the grid and stores the rows', async () => {
		const track = vi.fn()
		vi.stubGlobal('umami', { track })
		await renderTab()
		expect(document.body.textContent).toContain('Paste or upload a CSV to preview it here.')

		await pasteCsv(CSV)

		expect(latest?.customData.chart).toMatchObject({ chartType: 'line', xCol: 'day' })
		expect(document.body.textContent).toContain('2 rows · 2 columns')
		expect(latest?.customData.columns).toEqual([
			{ name: 'day', type: 'DATE' },
			{ name: 'value', type: 'BIGINT' }
		])
		expect(latest?.customData.storedRows).toEqual([
			[Date.UTC(2026, 0, 1), 10],
			[Date.UTC(2026, 0, 2), 20]
		])
		expect(latest?.customData.error).toBe('')

		expect(displayMode('Chart').checked).toBe(true)
		await act(async () => displayMode('Table').click())
		expect(displayMode('Table').checked).toBe(true)
		expect(latest?.customData.displayMode).toBe('table')
		expect(document.body.textContent).toContain('grid rows: 2')
		expect(track).toHaveBeenCalledWith('custom-data-display-table', undefined)
	})

	test('typing twice within the debounce window parses the CSV once', async () => {
		await renderTab()
		parsedCount = 0
		await typeCsv('day,value\n2026-01-01,1')
		await typeCsv(CSV)
		await waitForTypedParse()
		expect(parsedCount).toBe(1)
		expect(latest?.customData.storedRows).toEqual([
			[Date.UTC(2026, 0, 1), 10],
			[Date.UTC(2026, 0, 2), 20]
		])
	})

	test('a file read that finishes after the CSV was edited does not replace the edit', async () => {
		// The reader finishes only when the test says so, to land after the edit.
		const reads: Array<() => void> = []
		vi.stubGlobal(
			'FileReader',
			class extends EventTarget {
				result: string | null = null
				readAsText() {
					reads.push(() => {
						this.result = 'day,value\n2026-02-01,99'
						this.dispatchEvent(new Event('load'))
					})
				}
			}
		)
		await renderTab()
		const input = document.querySelector<HTMLInputElement>('input[type="file"]')!
		Object.defineProperty(input, 'files', { value: [new File(['ignored'], 'old.csv', { type: 'text/csv' })] })
		await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })))
		await pasteCsv(CSV)
		await act(async () => reads[0]())
		expect(latest?.customData.csvText).toBe(CSV)
		expect(latest?.customData.storedRows).toEqual([
			[Date.UTC(2026, 0, 1), 10],
			[Date.UTC(2026, 0, 2), 20]
		])
	})

	test('clearing the CSV before the parse runs drops the pending parse', async () => {
		await renderTab()
		parsedCount = 0
		await typeCsv(CSV)
		await typeCsv('')
		await waitForTypedParse()
		expect(parsedCount).toBe(0)
		expect(latest?.customData.storedRows).toBeNull()
	})

	test('emptying the CSV box removes the preview of the rows it held', async () => {
		await renderTab()
		await pasteCsv(CSV)
		expect(document.body.textContent).toContain('chart line: 2')

		await typeCsv('')
		expect(document.body.textContent).not.toContain('chart line')
		expect(document.body.textContent).toContain('Paste or upload a CSV to preview it here.')
	})

	test('the first keystroke in a saved card keeps its rows on screen until the new CSV parses', async () => {
		await renderTab({
			id: 'custom',
			kind: 'custom-data',
			name: 'Saved data',
			columns: [
				{ name: 'day', type: 'DATE' },
				{ name: 'value', type: 'BIGINT' }
			],
			rows: [
				[Date.UTC(2026, 0, 1), 10],
				[Date.UTC(2026, 0, 2), 20]
			],
			chart: { chartType: 'line', xCol: 'day', yCols: ['value'] } as CustomDataConfig['chart'],
			displayMode: 'chart'
		})
		expect(document.body.textContent).toContain('chart line: 2')

		await typeCsv('d')
		expect(document.body.textContent).toContain('chart line: 2')
	})

	test('reports a malformed CSV as plain text without storing rows', async () => {
		await renderTab()
		await pasteCsv('day,value\n2026-01-01')

		expect(document.body.textContent).toContain('Row 2 has 1 columns, expected 2.')
		expect(document.body.innerHTML).not.toContain('<script')
		expect(latest?.customData.storedRows).toBeNull()
	})
})

describe('a free account', () => {
	signInAs('free')

	test('shows the pro gate instead of the form without a subscription', async () => {
		await renderTab()

		expect(document.querySelector('textarea')).toBeNull()
		expect(document.body.textContent).toContain('Custom data')
		expect(document.body.textContent).toContain('This feature requires a Pro subscription.')
	})
})
