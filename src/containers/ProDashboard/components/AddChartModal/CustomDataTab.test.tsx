// @vitest-environment happy-dom

import { act, useReducer } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { installSubscriberSession, type SessionAccount } from '~/utils/test/subscriberSession'
import { CustomDataTab, TYPED_CSV_PARSE_DELAY_MS } from './CustomDataTab'
import { initializeFromEditItem, modalReducer } from './modalReducer'
import type { ModalState } from './types'

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
const renderTab = () =>
	act(async () =>
		root.render(
			<session.Wrapper>
				<Harness />
			</session.Wrapper>
		)
	)
let latest: ModalState | null = null
let parsedCount = 0

function Harness() {
	const [state, dispatch] = useReducer(modalReducer, null, () => initializeFromEditItem(null))
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

function button(label: string) {
	const found = Array.from(document.querySelectorAll('button')).find((node) => node.textContent?.trim() === label)
	if (!found) throw new Error(`Expected a "${label}" button`)
	return found
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
})

describe('a subscriber', () => {
	signInAs('subscriber')

	test('pasted CSV previews an auto-selected chart, switches to the grid and stores the rows', async () => {
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

		await act(async () => button('Table').click())
		expect(document.body.textContent).toContain('grid rows: 2')
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
