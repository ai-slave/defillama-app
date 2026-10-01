// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { useDarkModeManager } from '~/contexts/LocalStorage'
import { setThemeCookie } from '~/utils/cookies'
import { waitForUi } from '~/utils/testing/waitForUi'
import { Editor } from '../Editor'
import { SqlCell } from '../notebook/SqlCell'
import type { NotebookCell } from '../useSqlTabs'

// Monaco cannot run in happy-dom; these tests read only the theme each editor is given.
vi.mock('@monaco-editor/react', () => ({
	default: ({ theme }: { theme: string }) => <output aria-label="Monaco theme">{theme}</output>,
	loader: { config: () => {} }
}))

const cell: NotebookCell = {
	id: 'cell',
	type: 'sql',
	source: 'SELECT 1',
	result: null,
	running: false,
	runError: null,
	lastRun: null,
	loadingStage: null,
	pendingTables: [],
	dirty: false
}

function ThemeToggle() {
	const [, toggle] = useDarkModeManager()
	return (
		<button type="button" onClick={toggle}>
			Toggle theme
		</button>
	)
}

let root: Root
let container: HTMLDivElement
beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	setThemeCookie(false)
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

const themes = () => [...container.querySelectorAll('[aria-label="Monaco theme"]')].map((node) => node.textContent)

test('the SQL editor and notebook cells open in the site theme and follow its toggle', async () => {
	await act(async () =>
		root.render(
			<>
				<ThemeToggle />
				<Editor value="" onChange={() => {}} onRun={() => {}} tables={[]} />
				<SqlCell
					cell={cell}
					loadedTables={[]}
					onSourceChange={() => {}}
					onRun={() => {}}
					onRunAndAdvance={() => {}}
					onFocus={() => {}}
					onChartConfigChange={() => {}}
					onPreferredViewChange={() => {}}
				/>
			</>
		)
	)
	expect(themes()).toEqual(['llama-sql-light', 'llama-sql-light'])

	await act(async () => container.querySelector('button')!.click())
	// The theme store notifies its subscribers on the next task.
	await waitForUi(() => expect(themes()).toEqual(['llama-sql-dark', 'llama-sql-dark']))
})
