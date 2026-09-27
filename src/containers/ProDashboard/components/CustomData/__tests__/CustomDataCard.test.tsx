// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { DashboardTestProvider } from '~/utils/testing/dashboardContext'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import type { CustomDataConfig } from '../../../types'
import { CardHeightScaleContext } from '../../cardHeightContext'
import { DashboardCardContext } from '../../DashboardCardContext'
import { CustomDataCard } from '../CustomDataCard'
import { gzipBase64Encode } from '../rowsEncoding'

const appendItems = vi.fn()
vi.mock('next/router', () => ({ useRouter: () => ({ pathname: '/pro/test', query: {} }) }))
const session = installSubscriberSession('u1', { resolved: true })
// The results grid and the SQL chart are heavy children; these tests read the rows they receive.
vi.mock('~/containers/Downloads/sql/ResultsGrid', () => ({
	ResultsGrid: ({ result }: { result: { rows: Array<Array<unknown>> } }) => (
		<p>
			grid rows: {result.rows.length}, last row: {result.rows.at(-1)?.join(' ')}
		</p>
	)
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
	appendItems.mockClear()
	cardEdit.mockClear()
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

type RenderOptions = { streamDone?: boolean; scale?: number; isReadOnly?: boolean; editable?: boolean }

async function render(
	config: CustomDataConfig,
	{ streamDone = true, scale = 1, isReadOnly = false, editable = false }: RenderOptions = {}
) {
	const card = (
		<CardHeightScaleContext.Provider value={scale}>
			<CustomDataCard config={config} />
		</CardHeightScaleContext.Provider>
	)
	await act(async () =>
		root.render(
			<session.Wrapper>
				<DashboardTestProvider
					mode={isReadOnly ? 'view' : 'edit'}
					streamDone={streamDone}
					permissions={{ isReadOnly }}
					editorActions={{ handleAppendItems: appendItems }}
				>
					{editable ? <DashboardCardContext.Provider value={cardContext}>{card}</DashboardCardContext.Provider> : card}
				</DashboardTestProvider>
			</session.Wrapper>
		)
	)
}

function buttonNamed(name: string) {
	return [...document.querySelectorAll<HTMLElement>('button, [role="menuitem"]')].find(
		(node) => node.textContent?.trim() === name
	)
}

async function openMenu() {
	const menu = container.querySelector<HTMLButtonElement>('[aria-label="More actions"]')
	if (menu) await act(async () => menu.click())
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
	await openMenu()
	const duplicate = buttonNamed('Duplicate')
	expect(duplicate).toBeDefined()
	await act(async () => duplicate?.click())
	expect(appendItems).toHaveBeenCalledOnce()
	const created = appendItems.mock.calls[0]?.[0]([])[0] as CustomDataConfig
	expect(created).toMatchObject({ kind: 'custom-data', name: 'Treasury (Duplicate)', rows: base.rows })
	expect(created.id).not.toBe(base.id)
})

test('hides duplication for read-only viewers and explains datasets without numeric columns', async () => {
	await render(
		{
			...base,
			displayMode: 'chart',
			columns: [{ name: 'day', type: 'DATE' }],
			rows: [['2026-01-01'], ['2026-01-02']]
		},
		{ isReadOnly: true }
	)
	await openMenu()
	expect(buttonNamed('Duplicate')).toBeUndefined()
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
	await waitForUi(() =>
		expect(container.textContent).toContain(`grid rows: 1500, last row: ${Date.UTC(2026, 0, 16)} 1499`)
	)
})

test('shows a loader while rows are still streaming and an empty state once the stream is done', async () => {
	const { rows: _rows, ...withoutRows } = base
	await render(withoutRows, { streamDone: false })
	expect(container.textContent).toContain('Loading')
	await render(withoutRows)
	expect(container.textContent).toContain('No rows stored.')
	expect(container.textContent).toContain('0 rows')
})

test('unreadable stored rows offer the editor when the card is editable', async () => {
	await render({ ...base, rows: { encoding: 'gzip-base64', data: 'not-gzip', rowCount: 2 } }, { editable: true })
	await waitForUi(() => expect(container.textContent).toContain("Stored rows couldn't be read"))
	const edit = [...container.querySelectorAll<HTMLElement>('[role="status"] button')].find(
		(node) => node.textContent === 'Edit card'
	)
	expect(edit).toBeDefined()
	await act(async () => edit?.click())
	expect(cardEdit).toHaveBeenCalledOnce()
})

test('unreadable stored rows explain the fix instead of printing the decoder error', async () => {
	await render({ ...base, rows: { encoding: 'gzip-base64', data: 'not-gzip', rowCount: 2 } })
	await waitForUi(() => expect(container.textContent).toContain("Stored rows couldn't be read"))
	const alert = [...container.querySelectorAll('[role="status"]')].find((node) =>
		node.textContent?.includes("Stored rows couldn't be read")
	)
	expect(alert?.textContent).toContain("Stored rows couldn't be read")
	expect(alert?.textContent).toContain('Edit the card and upload the file again.')
	expect(alert?.textContent).not.toContain('gzip')
	expect(alert?.querySelector('button')).toBeNull()
})
