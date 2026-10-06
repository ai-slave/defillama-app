// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { DashboardTestProvider } from '~/utils/testing/dashboardContext'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { virtualViewport } from '~/utils/testing/virtualLayout'
import { waitForUi } from '~/utils/testing/waitForUi'
import type { CustomDataConfig } from '../../../types'
import { DashboardCardContext } from '../../DashboardCardContext'
import { CustomDataCard } from '../CustomDataCard'
import { gzipBase64Encode } from '../rowsEncoding'

const appendItems = vi.fn()
vi.mock('next/router', () => ({ useRouter: () => ({ pathname: '/pro/test', query: {} }) }))
const session = installSubscriberSession('u1', { resolved: true })
vi.mock('@tanstack/react-virtual', async (original) =>
	(await import('~/utils/testing/virtualLayout')).withVirtualLayout(await original())
)
// Drawing the chart is a heavy child nothing here reads.
vi.mock('~/containers/Downloads/sql/chart', () => ({ ChartRouter: () => null }))

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

type RenderOptions = { streamDone?: boolean; isReadOnly?: boolean; editable?: boolean }

async function render(
	config: CustomDataConfig,
	{ streamDone = true, isReadOnly = false, editable = false }: RenderOptions = {}
) {
	const card = <CustomDataCard config={config} />
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

/** The cell texts of each body row the results grid shows. */
function gridRows() {
	return [...container.querySelectorAll('[role="row"]')]
		.map((row) => [...row.querySelectorAll('[role="cell"]')].map((cell) => cell.textContent))
		.filter((cells) => cells.length > 0)
}

function menuLabels() {
	return [...document.querySelectorAll('[role="menuitem"]')].map((node) => node.textContent?.trim())
}

test('renders inline rows as a table with the plain-text name, source and row count, without an image export', async () => {
	await render({ ...base, name: '<b>Treasury</b>' })
	expect(container.querySelector('h2')?.textContent).toBe('<b>Treasury</b>')
	expect(container.querySelector('h2')?.querySelector('b')).toBeNull()
	expect(container.textContent).toContain('treasury.csv')
	expect(container.textContent).toContain('2 rows')
	expect(gridRows()).toEqual([
		['2026-01-01', '1'],
		['2026-01-02', '2']
	])
	await openMenu()
	expect(menuLabels()).not.toContain('Download image')
})

test('the chart view offers an image export instead of the table, and duplicates the dataset with a fresh id', async () => {
	await render({ ...base, displayMode: 'chart' })
	expect(gridRows()).toEqual([])
	await openMenu()
	expect(menuLabels()).toContain('Download image')
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
	await waitForUi(() => expect(gridRows()[0]).toEqual(['2026-01-01', '0']))
	await act(async () => virtualViewport.scroll(1500 * 28))
	expect(gridRows().at(-1)).toEqual(['2026-01-16', '1,499'])
})

test('replacing compressed rows shows a loader, not the previous rows, while the new ones decode', async () => {
	const encoded = async (rows: Array<[string, number]>) => ({
		encoding: 'gzip-base64' as const,
		data: await gzipBase64Encode(JSON.stringify(rows)),
		rowCount: rows.length
	})
	const first = await encoded([['2026-01-01', 111]])
	const second = await encoded([
		['2026-01-01', 111],
		['2026-01-02', 222]
	])
	await render({ ...base, rows: first })
	await waitForUi(() => expect(gridRows()).toEqual([['2026-01-01', '111']]))
	await render({ ...base, rows: second })
	const textDuringDecode = container.textContent
	const rowsDuringDecode = gridRows()
	await waitForUi(() => expect(gridRows()).toHaveLength(2))

	expect(textDuringDecode).toContain('Loading')
	expect(rowsDuringDecode).toEqual([])
})

test('the same compressed rows arriving again as a new object keep drawing without a loader', async () => {
	const rows = [['2026-01-01', 111]]
	const data = await gzipBase64Encode(JSON.stringify(rows))
	await render({ ...base, rows: { encoding: 'gzip-base64', data, rowCount: 1 } })
	await waitForUi(() => expect(gridRows()).toEqual([['2026-01-01', '111']]))
	await render({ ...base, rows: { encoding: 'gzip-base64', data, rowCount: 1 } })

	expect(container.textContent).not.toContain('Loading')
	expect(gridRows()).toEqual([['2026-01-01', '111']])
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
