// @vitest-environment happy-dom
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { DASHBOARD_CARD_HEIGHT_SCALE } from '../../dashboardLayout/cardHeight'
import type { CustomDataConfig } from '../../types'
import { CardHeightScaleContext } from '../cardHeightContext'
import { DashboardCardContext } from '../DashboardCardContext'
import { CustomDataCard } from './CustomDataCard'
import { gzipBase64Encode } from './rowsEncoding'

const mocks = vi.hoisted(() => ({
	appendItems: vi.fn(),
	isReadOnly: false
}))
const streamContext = vi.hoisted(() => ({ done: true }))
vi.mock('../../ProDashboardAPIContext', () => ({
	useProDashboardPermissions: () => ({ isReadOnly: mocks.isReadOnly }),
	useProDashboardEditorActions: () => ({ handleAppendItems: mocks.appendItems })
}))
vi.mock('../../queries', async () => {
	const { createContext } = await import('react')
	return { StreamDoneContext: createContext(true) }
})
vi.mock('../ProCardHeader', () => ({
	ProCardHeader: ({
		title,
		subtitle,
		menu
	}: {
		title?: string
		subtitle?: ReactNode
		menu?: { onDuplicate?: () => void }
	}) => (
		<div>
			<h2>{title}</h2>
			{subtitle}
			{menu?.onDuplicate ? (
				<button type="button" onClick={menu.onDuplicate}>
					Duplicate
				</button>
			) : null}
		</div>
	)
}))
vi.mock('~/containers/Downloads/sql/ResultsGrid', () => ({
	ResultsGrid: ({ result }: { result: { rows: Array<unknown> } }) => <p>grid rows: {result.rows.length}</p>
}))
vi.mock('~/containers/Downloads/sql/chart', () => ({
	ChartRouter: ({
		config,
		result,
		height
	}: {
		config: { chartType: string }
		result: { rows: Array<unknown> }
		height?: string
	}) => (
		<p data-height={height}>
			chart {config.chartType}: {result.rows.length}
		</p>
	)
}))
vi.mock('~/ui/Loaders', () => ({ LoadingSpinner: () => <p>loading</p> }))

const chart: CustomDataConfig['chart'] = {
	chartType: 'line',
	xCol: 'day',
	yCols: ['value'],
	splitByCol: null,
	stackMode: 'off',
	rightAxisCols: [],
	seriesKinds: {},
	seriesColors: {},
	numberFormat: 'auto'
}
const base: CustomDataConfig = {
	id: 'custom',
	kind: 'custom-data',
	name: 'Treasury',
	sourceName: 'treasury.csv',
	columns: [
		{ name: 'day', type: 'DATE' },
		{ name: 'value', type: 'DOUBLE' }
	],
	rows: [
		['2026-01-01', 1],
		['2026-01-02', 2]
	],
	chart,
	displayMode: 'table'
}

const cardEdit = vi.fn()
const cardContext = { itemId: base.id, onEdit: cardEdit }

let container: HTMLDivElement
let root: Root
beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	mocks.appendItems.mockClear()
	cardEdit.mockClear()
	mocks.isReadOnly = false
	streamContext.done = true
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

async function render(config: CustomDataConfig, streamDone = true, scale = 1) {
	const { StreamDoneContext } = await import('../../queries')
	await act(async () =>
		root.render(
			<StreamDoneContext.Provider value={streamDone}>
				<CardHeightScaleContext.Provider value={scale}>
					<CustomDataCard config={config} />
				</CardHeightScaleContext.Provider>
			</StreamDoneContext.Provider>
		)
	)
}

function chartHeight() {
	return container.querySelector('p[data-height]')?.getAttribute('data-height')
}

test('renders inline rows as a table with the plain-text name, source and row count', async () => {
	await render({ ...base, name: '<b>Treasury</b>' })
	expect(container.querySelector('h2')?.textContent).toBe('<b>Treasury</b>')
	expect(container.querySelector('h2')?.querySelector('b')).toBeNull()
	expect(container.textContent).toContain('treasury.csv')
	expect(container.textContent).toContain('2 rows')
	expect(container.textContent).toContain('grid rows: 2')
	expect(container.textContent).not.toContain('chart')
})

test('renders the chart view and duplicates the dataset with a fresh id when editable', async () => {
	await render({ ...base, displayMode: 'chart' })
	expect(container.textContent).toContain('chart line: 2')
	expect(chartHeight()).toBe('420px')
	const duplicate = Array.from(container.querySelectorAll('button')).find((node) => node.textContent === 'Duplicate')
	expect(duplicate).toBeDefined()
	await act(async () => duplicate?.click())
	expect(mocks.appendItems).toHaveBeenCalledOnce()
	const created = mocks.appendItems.mock.calls[0]?.[0]([])[0] as CustomDataConfig
	expect(created).toMatchObject({ kind: 'custom-data', name: 'Treasury (Duplicate)', rows: base.rows })
	expect(created.id).not.toBe(base.id)
})

test('hides duplication for read-only viewers and explains datasets without numeric columns', async () => {
	mocks.isReadOnly = true
	await render({
		...base,
		displayMode: 'chart',
		columns: [{ name: 'day', type: 'DATE' }],
		rows: [['2026-01-01'], ['2026-01-02']]
	})
	expect(container.querySelector('button')).toBeNull()
	expect(container.textContent).toContain('No numeric columns in this dataset to chart.')
})

test('decodes compressed rows lazily before rendering them', async () => {
	const rows = Array.from({ length: 1500 }, (_, index) => [
		`2026-01-${String((index % 28) + 1).padStart(2, '0')}`,
		index
	])
	const data = await gzipBase64Encode(JSON.stringify(rows))
	await render({ ...base, rows: { encoding: 'gzip-base64', data, rowCount: 1500 } })
	expect(container.textContent).toContain('1,500 rows')
	await vi.waitFor(() => expect(container.textContent).toContain('grid rows: 1500'))
})

test('shows a loader while rows are still streaming and an empty state once the stream is done', async () => {
	const { rows: _rows, ...withoutRows } = base
	await render(withoutRows, false)
	expect(container.textContent).toContain('Loading')
	await render(withoutRows, true)
	expect(container.textContent).toContain('No rows stored.')
	expect(container.textContent).toContain('0 rows')
})

test('surfaces a decoding failure instead of an endless loader', async () => {
	await render({ ...base, rows: { encoding: 'gzip-base64', data: '!!!not-base64!!!', rowCount: 3 } })
	await vi.waitFor(() => expect(container.textContent).not.toContain('loading'))
	expect(container.querySelector('[role="status"]')?.textContent).toBeTruthy()
})

test('unreadable stored rows offer the editor when the card is editable', async () => {
	const { StreamDoneContext } = await import('../../queries')
	await act(async () =>
		root.render(
			<StreamDoneContext.Provider value>
				<DashboardCardContext.Provider value={cardContext}>
					<CustomDataCard config={{ ...base, rows: { encoding: 'gzip-base64', data: 'not-gzip', rowCount: 2 } }} />
				</DashboardCardContext.Provider>
			</StreamDoneContext.Provider>
		)
	)
	await vi.waitFor(() => expect(container.querySelector('[role="status"]')).not.toBeNull())
	const edit = Array.from(container.querySelectorAll('button')).find((node) => node.textContent === 'Edit card')
	expect(edit).toBeDefined()
	await act(async () => edit?.click())
	expect(cardEdit).toHaveBeenCalledOnce()
})

test('unreadable stored rows explain the fix instead of printing the decoder error', async () => {
	await render({ ...base, rows: { encoding: 'gzip-base64', data: 'not-gzip', rowCount: 2 } })
	await vi.waitFor(() => expect(container.querySelector('[role="status"]')).not.toBeNull())
	const alert = container.querySelector('[role="status"]')
	expect(alert?.textContent).toContain("Stored rows couldn't be read")
	expect(alert?.textContent).toContain('Edit the card and upload the file again.')
	expect(alert?.textContent).not.toContain('gzip')
	expect(Array.from(container.querySelectorAll('button')).some((node) => node.textContent === 'Edit card')).toBe(false)
})

test('the card height preset scales the chart instead of padding the card', async () => {
	await render({ ...base, displayMode: 'chart' }, true, DASHBOARD_CARD_HEIGHT_SCALE.compact)
	expect(chartHeight()).toBe('315px')
	await render({ ...base, displayMode: 'chart' }, true, DASHBOARD_CARD_HEIGHT_SCALE.tall)
	expect(chartHeight()).toBe('588px')
})
