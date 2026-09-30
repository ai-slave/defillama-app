// @vitest-environment happy-dom
import * as Ariakit from '@ariakit/react'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { accessibleName } from '~/utils/testing/accessibleName'
import { fixtureStatus } from '~/utils/testing/fixtureFetch'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import { LlamaAIChartPickerDialog } from '../LlamaAIChartPicker'
import { LlamaAIChart } from '../nodes/LlamaAIChart'
import { makeEmptyPeoplePanelItem, type ArticlePeoplePanelConfig } from '../peoplePanel'
import { PeoplePanelDialog } from '../PeoplePanelDialog'

const api = vi.hoisted(() => ({ error: vi.fn() }))
const session = installSubscriberSession('article-editor')
vi.mock('react-hot-toast', () => ({ default: { error: api.error, promise: (promise: Promise<unknown>) => promise } }))
let root: Root
let container: HTMLDivElement
let store: Ariakit.DialogStore
let editor: Editor
beforeEach(() => {
	vi.resetAllMocks()
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
	session.client.setDefaultOptions({ queries: { retry: false } })
	session.serve({ '/charts': { charts: [{ id: 'saved', title: 'Saved chart', created_at: '2026-09-01' }] } })
	editor = new Editor({ extensions: [StarterKit, LlamaAIChart], content: '<p>Draft</p>' })
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	editor.destroy()
})
function deferred<T>() {
	let resolve!: (value: T) => void
	const promise = new Promise<T>((done) => {
		resolve = done
	})
	return { promise, resolve }
}
function findButton(name: string) {
	return [...document.querySelectorAll<HTMLButtonElement>('button')].find((e) => accessibleName(e) === name)
}
async function click(name: string) {
	const button = await waitForUi(() => {
		const found = findButton(name)
		expect(found).toBeDefined()
		return found!
	})
	await act(async () => button.click())
}
async function mountPanel(initialConfig: ArticlePeoplePanelConfig | null = peopleConfig) {
	const submit = vi.fn()
	function Harness() {
		store = Ariakit.useDialogStore({ defaultOpen: true })
		return <PeoplePanelDialog store={store} articleId="article" onSubmit={submit} initialConfig={initialConfig} />
	}
	await act(async () =>
		root.render(
			<session.Wrapper>
				<Harness />
			</session.Wrapper>
		)
	)
	return submit
}
const peopleConfig = {
	label: 'People',
	items: ['Alice', 'Bob'].map((name) => ({ ...makeEmptyPeoplePanelItem(), name, src: `/${name}.png` }))
}
async function uploadFirst(file = new File(['image'], 'replacement.png', { type: 'image/png' })) {
	await act(async () => {
		const input = document.querySelector<HTMLInputElement>('input[type="file"]')!
		Object.defineProperty(input, 'files', { value: [file] })
		input.dispatchEvent(new Event('change', { bubbles: true }))
	})
}
test('keeps an upload attached to its person after reordering', async () => {
	const pending = deferred<Response>()
	session.serve({ '/uploads/image': () => pending.promise })
	const submit = await mountPanel()
	await uploadFirst()
	await click('Uploading images…')
	expect(submit).not.toHaveBeenCalled()
	await click('Move person 1 down')
	await act(async () => pending.resolve(Response.json({ id: 'new', url: '/new.png', width: 100, height: 100 })))
	await click('Update panel')
	expect(submit.mock.calls[0][0].items.map(({ name, src }: { name: string; src: string }) => ({ name, src }))).toEqual([
		{ name: 'Bob', src: '/Bob.png' },
		{ name: 'Alice', src: '/new.png' }
	])
})
test('an in-flight upload of a removed person does not block saving the remaining people', async () => {
	const pending = deferred<Response>()
	session.serve({ '/uploads/image': () => pending.promise })
	const submit = await mountPanel()
	await uploadFirst()
	await click('Remove person 1')
	await click('Update panel')
	expect(submit.mock.calls[0][0].items).toMatchObject([{ name: 'Bob', src: '/Bob.png' }])
})
test('inserting a panel with a person missing an image shows the error on that row and focuses its image', async () => {
	const submit = await mountPanel(null)
	await click('Insert panel')
	expect(submit).not.toHaveBeenCalled()
	expect(document.querySelector('[role="dialog"]')?.textContent).toContain('An image is required for each person.')
	expect(accessibleName(document.activeElement!)).toBe('Upload image')
	expect(store.getState().open).toBe(true)
})
test('a failed upload shows a plain error under that person, not a toast or the server message', async () => {
	session.serve({ '/uploads/image': fixtureStatus(500, { error: 'bucket write failed' }) })
	await mountPanel()
	await uploadFirst()
	await waitForUi(() =>
		expect(document.querySelector('[role="dialog"]')?.textContent).toContain("Couldn't upload this image. Try again.")
	)
	expect(document.body.textContent).not.toContain('bucket write failed')
	expect(api.error).not.toHaveBeenCalled()
})
test('an image the upload rejects before sending says how to fix it', async () => {
	await mountPanel()
	await uploadFirst(new File(['notes'], 'notes.txt', { type: 'text/plain' }))
	await waitForUi(() =>
		expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Allowed formats: PNG, JPEG, WebP, GIF')
	)
})
const chart = {
	chartConfig: {
		id: 'saved',
		type: 'bar',
		title: 'Saved chart',
		description: '',
		axes: {
			x: { field: 'day', label: 'Day', type: 'category' },
			yAxes: [{ id: 'y', fields: ['value'], label: 'Value', position: 'left' }]
		},
		series: [
			{
				name: 'Value',
				type: 'bar',
				yAxisId: 'y',
				metricClass: 'stock',
				dataMapping: { xField: 'day', yField: 'value' },
				styling: {}
			}
		],
		dataTransformation: { timeField: 'day', metrics: ['value'] }
	},
	chartData: [{ day: 'Monday', value: 1 }]
}
async function mountCharts() {
	function Harness() {
		store = Ariakit.useDialogStore({ defaultOpen: true })
		return (
			<session.Wrapper>
				<LlamaAIChartPickerDialog dialogStore={store} editor={editor} />
			</session.Wrapper>
		)
	}
	await act(async () => root.render(<Harness />))
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 30))
	})
}
test('closing and reopening the picker ignores an old insertion but allows the new one', async () => {
	const first = deferred<Response>()
	const second = deferred<Response>()
	let detailRequest = 0
	session.serve({ '/charts/saved': () => (++detailRequest === 1 ? first.promise : second.promise) })
	await mountCharts()
	const select = async () => {
		await act(async () =>
			[...document.querySelectorAll<HTMLButtonElement>('button')]
				.find((e) => e.textContent?.includes('Saved chart'))!
				.click()
		)
	}
	await select()
	await act(async () => store.hide())
	await act(async () => store.show())
	await select()
	await act(async () => first.resolve(Response.json(chart)))
	expect(editor.getJSON().content?.some((n) => n.type === 'llamaaiChart')).toBe(false)
	expect(
		[...document.querySelectorAll<HTMLButtonElement>('button')]
			.find((e) => e.textContent?.includes('Saved chart'))!
			.getAttribute('aria-busy')
	).toBe('true')
	expect(document.body.textContent).toContain('Inserting…')
	await act(async () => second.resolve(Response.json(chart)))
	expect(editor.getJSON().content?.filter((n) => n.type === 'llamaaiChart')).toHaveLength(1)
	expect(store.getState().open).toBe(false)
	expect(api.error).not.toHaveBeenCalled()
})

test('offers a retry for list failures and distinguishes a search miss from an empty library', async () => {
	session.serve({
		'/charts': () => {
			throw new Error('Offline')
		}
	})
	await mountCharts()
	expect(document.querySelector('[role="alert"]')?.textContent).toContain("Couldn't load your saved charts.")
	expect(document.body.textContent).not.toContain('No saved charts yet')
	session.serve({ '/charts': { charts: [{ id: 'saved', title: 'Saved chart', created_at: '2026-09-01' }] } })
	await click('Try again')
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 30))
	})
	await act(async () => {
		const input = document.querySelector<HTMLInputElement>('[name="llamaai-chart-search"]')!
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'Nonexistent')
		input.dispatchEvent(new Event('input', { bubbles: true }))
	})
	expect(document.body.textContent).toContain('No saved charts match your search')
	expect(document.body.textContent).not.toContain('No saved charts yet')
})

async function selectSavedChart() {
	await act(async () =>
		[...document.querySelectorAll<HTMLButtonElement>('button')]
			.find((e) => e.textContent?.includes('Saved chart'))!
			.click()
	)
}
test('a failed insertion shows a plain error under the chart inside the open picker, and a retry inserts it', async () => {
	session.serve({
		'/charts/saved': () => {
			throw new Error('Detail unavailable')
		}
	})
	await mountCharts()
	await selectSavedChart()
	await waitForUi(() =>
		expect(document.querySelector('li [role="alert"]')?.textContent).toBe("Couldn't insert this chart. Try again.")
	)
	expect(document.body.textContent).not.toContain('Detail unavailable')
	expect(api.error).not.toHaveBeenCalled()
	expect(store.getState().open).toBe(true)
	session.serve({ '/charts/saved': chart })
	await selectSavedChart()
	await waitForUi(() => expect(editor.getJSON().content?.filter((n) => n.type === 'llamaaiChart')).toHaveLength(1))
})
test('a saved chart without usable data says so instead of inserting', async () => {
	session.serve({ '/charts/saved': { chartConfig: chart.chartConfig, chartData: [] } })
	await mountCharts()
	await selectSavedChart()
	await waitForUi(() =>
		expect(document.querySelector('li [role="alert"]')?.textContent).toBe('This chart has no data to insert.')
	)
	expect(editor.getJSON().content?.some((n) => n.type === 'llamaaiChart')).toBe(false)
})
