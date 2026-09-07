// @vitest-environment happy-dom
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { SqlChartConfig } from '../../../types'
import { SqlChartModal } from '../SqlChartModal'

const api = vi.hoisted(() => ({ run: vi.fn(), load: vi.fn(), add: vi.fn(), edit: vi.fn(), save: vi.fn() }))
vi.mock('~/auth', () => ({ useAuthContext: () => ({ authorizedFetch: vi.fn() }) }))
vi.mock('~/containers/Downloads/sql/useDuckDB', () => ({ useDuckDB: () => ({ conn: {}, status: 'ready' }) }))
vi.mock('~/containers/Downloads/sql/executor', () => ({ runSql: api.run }))
vi.mock('~/containers/Downloads/sql/useTableRegistry', () => ({
	useTableRegistry: () => ({ tables: [], load: api.load }),
	tableNameFor: () => 'chart_table'
}))
vi.mock('~/containers/Downloads/sql/Editor', () => ({
	Editor: ({ value, onChange }: { value: string; onChange: (s: string) => void }) => (
		<textarea aria-label="SQL" value={value} onChange={(event) => onChange(event.target.value)} />
	)
}))
vi.mock('~/containers/Downloads/sql/ResultsPanel', () => ({ ResultsPanel: () => null }))
vi.mock('~/contexts/LocalStorage', () => ({
	useSavedDownloads: () => ({ savedDownloads: [], saveDownload: api.save })
}))
vi.mock('../../../ProDashboardAPIContext', () => ({
	useProDashboardEditorActions: () => ({ handleAddSqlChart: api.add, handleEditItem: api.edit })
}))
vi.mock('../chartOptions', () => ({ loadChartOptions: async () => ({}) }))
vi.mock('../SqlChartModalSidebar', () => ({
	SqlChartModalSidebar: ({ onApplySaved }: { onApplySaved: (query: object) => void }) => (
		<button
			type="button"
			onClick={() =>
				onApplySaved({
					id: 'saved',
					name: 'Saved query',
					sql: 'SELECT * FROM chart_table',
					tables: [{ kind: 'chart', slug: 'chain-tvl', param: 'Ethereum' }]
				})
			}
		>
			Apply saved
		</button>
	)
}))
let root: Root
let container: HTMLDivElement
beforeEach(() => {
	vi.resetAllMocks()
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})
const item = {
	id: 'sql',
	kind: 'sql',
	name: 'Query',
	query: { sql: 'SELECT 1 AS value', tableSources: [] }
} as SqlChartConfig
async function mount() {
	function Harness() {
		const [open, setOpen] = useState(true)
		return open ? <SqlChartModal editItem={item} onClose={() => setOpen(false)} /> : <p>Closed</p>
	}
	await act(async () => root.render(<Harness />))
}
async function click(name: string) {
	await act(async () =>
		[...document.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.trim() === name)!.click()
	)
}
test('closing during source preparation aborts loading and never starts execution', async () => {
	let finish!: () => void
	api.load.mockImplementation(
		() =>
			new Promise<void>((resolve) => {
				finish = resolve
			})
	)
	await mount()
	await click('Apply saved')
	expect(api.load).toHaveBeenCalledOnce()
	const signal = api.load.mock.calls[0][1] as AbortSignal
	await click('Cancel')
	expect(signal.aborted).toBe(true)
	await act(async () => finish())
	expect(api.run).not.toHaveBeenCalled()
	expect(api.edit).not.toHaveBeenCalled()
})
test('closing a save ignores a late successful query result', async () => {
	let finish!: (value: object) => void
	api.run.mockImplementation(
		() =>
			new Promise((resolve) => {
				finish = resolve
			})
	)
	await mount()
	await click('Save changes')
	await click('Cancel')
	await act(async () =>
		finish({ ok: true, result: { columns: [{ name: 'value', type: 'INTEGER' }], rows: [[1]] }, durationMs: 1 })
	)
	expect(api.edit).not.toHaveBeenCalled()
	expect(api.save).not.toHaveBeenCalled()
})
test('a query failure leaves Save available, and retry saves the matching query result', async () => {
	api.run.mockResolvedValueOnce({ ok: false, error: 'Query failed' }).mockResolvedValueOnce({
		ok: true,
		result: { columns: [{ name: 'value', type: 'INTEGER' }], rows: [[1]] },
		durationMs: 1
	})
	await mount()
	await click('Save changes')
	expect(document.body.textContent).toContain('Query failed')
	expect(api.edit).not.toHaveBeenCalled()
	await click('Save changes')
	expect(api.edit).toHaveBeenCalledOnce()
	expect(api.edit.mock.calls[0][1]).toMatchObject({ query: { sql: 'SELECT 1 AS value' }, snapshot: { rows: [[1]] } })
	expect(container.textContent).toBe('Closed')
})
