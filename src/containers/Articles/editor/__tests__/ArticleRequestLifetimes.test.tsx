// @vitest-environment happy-dom
import * as Ariakit from '@ariakit/react'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { LlamaAIChartPickerDialog } from '../LlamaAIChartPicker'
import { LlamaAIChart } from '../nodes/LlamaAIChart'
import { makeEmptyPeoplePanelItem } from '../peoplePanel'
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
async function click(name: string) {
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 0))
	})
	await act(async () => {
		const button = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
			(e) => e.getAttribute('aria-label') === name || e.textContent?.trim() === name
		)!
		button.click()
	})
}
async function mountPanel() {
	const submit = vi.fn()
	function Harness() {
		store = Ariakit.useDialogStore({ defaultOpen: true })
		return (
			<PeoplePanelDialog
				store={store}
				articleId="article"
				onSubmit={submit}
				initialConfig={{
					label: 'People',
					items: ['Alice', 'Bob'].map((name) => ({ ...makeEmptyPeoplePanelItem(), name, src: `/${name}.png` }))
				}}
			/>
		)
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
async function uploadFirst() {
	await act(async () => {
		const input = document.querySelector<HTMLInputElement>('input[type="file"]')!
		Object.defineProperty(input, 'files', { value: [new File(['image'], 'replacement.png', { type: 'image/png' })] })
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
		[...document.querySelectorAll<HTMLButtonElement>('button')].find((e) => e.textContent?.includes('Saved chart'))!
			.disabled
	).toBe(true)
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
	expect(document.querySelector('[role="alert"]')?.textContent).toContain('Could not load saved charts')
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

test('allows insertion retry after a detail request fails', async () => {
	session.serve({
		'/charts/saved': () => {
			throw new Error('Detail unavailable')
		}
	})
	await mountCharts()
	const select = async () => {
		await act(async () =>
			[...document.querySelectorAll<HTMLButtonElement>('button')]
				.find((e) => e.textContent?.includes('Saved chart'))!
				.click()
		)
	}
	await select()
	expect(api.error).toHaveBeenCalledWith('Detail unavailable')
	expect(store.getState().open).toBe(true)
	session.serve({ '/charts/saved': chart })
	await select()
	expect(editor.getJSON().content?.filter((n) => n.type === 'llamaaiChart')).toHaveLength(1)
})
