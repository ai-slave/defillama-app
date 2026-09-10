// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { appendReasoning, completeToolStep, startToolStep, stepsForMessage } from '~/containers/LlamaAI/agentSteps'
import { mapPersistedMessage } from '~/containers/LlamaAI/messageMappers'
import type { AgentStep, ToolExecution } from '~/containers/LlamaAI/types'
import { AgentTimeline } from './AgentTimeline'

vi.mock('~/containers/LlamaAI/components/status/useHackerMode', () => ({ useHackerMode: () => false }))
vi.mock('~/containers/LlamaAI/components/status/useCurrentSecond', () => ({ useCurrentSecond: () => 1_700_000_010 }))

let container: HTMLDivElement
let root: Root

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

const draw = (steps: Array<AgentStep>, streaming: boolean) =>
	act(async () =>
		root.render(
			<AgentTimeline steps={steps} streaming={streaming} showToolDetails executionStartedAt={1_700_000_000_000} />
		)
	)
// Row text with one space between its parts; textContent runs adjacent spans together.
const textOf = (node: Node): string =>
	node.nodeType === Node.TEXT_NODE ? (node.textContent ?? '') : [...node.childNodes].map(textOf).join(' ')
const rows = () => [...container.querySelectorAll('li')].map((li) => textOf(li).replace(/\s+/g, ' ').trim())
// The first expandable button is the header; row toggles come after it in the DOM.
const header = () => container.querySelector<HTMLButtonElement>('button[aria-expanded]')!

test('shows the rows as they happen under the llama header, with nothing to click to see them', async () => {
	let steps: Array<AgentStep> = []
	await draw(steps, true)
	expect(container.querySelector('img')).not.toBeNull()
	expect(header().textContent).toContain('LlamaAI is working…')
	expect(header().textContent).toContain('10s')
	expect(container.textContent).not.toContain('View steps')
	expect(rows()).toEqual(['Thinking…'])

	steps = appendReasoning(steps, 'I notice the last row shows TVL dropping. ')
	await draw(steps, true)
	// The row being written is open and shows its text, not a made-up title.
	expect(rows()).toEqual(['Reasoning I notice the last row shows TVL dropping.'])
	expect(header().textContent).toContain('LlamaAI is working…')

	const llama = container.querySelector('img')
	steps = startToolStep(steps, { name: 'execute_sql', params: { query: 'select 1' }, toolCallId: 'c1' })
	await draw(steps, true)
	// The reasoning row folded to a preview when the tool row arrived after it.
	expect(rows()).toEqual([
		'Reasoning : I notice the last row shows TVL dropping.',
		'Querying database : {"query":"select 1"} running'
	])
	expect(container.querySelector('img')).toBe(llama)

	// The result lands in the same row; a new reasoning stretch opens a new row after it.
	steps = completeToolStep(steps, {
		name: 'execute_sql',
		tool_call_id: 'c1',
		executionTimeMs: 1200,
		success: true,
		resultCount: 4
	})
	steps = appendReasoning(steps, 'Now the chart.')
	await draw(steps, true)
	expect(rows()).toEqual([
		'Reasoning : I notice the last row shows TVL dropping.',
		'Querying database : 4 results 1.2s',
		'Reasoning Now the chart.'
	])
	expect(
		[...container.querySelectorAll('li button[aria-expanded]')].map((b) => b.getAttribute('aria-expanded'))
	).toEqual(['false', 'false', 'true'])
	expect(container.textContent).not.toContain('execute_sql')

	// The header folds the list for anyone who wants it quiet.
	await act(async () => header().click())
	expect(container.querySelectorAll('li')).toHaveLength(0)
	expect(container.querySelector('img')).toBe(llama)
})

test('a finished message folds to a sentence of what happened, and that sentence opens the rows', async () => {
	let steps: Array<AgentStep> = appendReasoning([], 'Plan.')
	steps = startToolStep(steps, { name: 'execute_sql', params: { q: 'a' }, toolCallId: 'a', isPremium: true })
	steps = completeToolStep(steps, { name: 'execute_sql', tool_call_id: 'a', executionTimeMs: 300, success: true })
	steps = startToolStep(steps, { name: 'execute_sql', params: { q: 'b' }, toolCallId: 'b' })
	steps = completeToolStep(steps, { name: 'execute_sql', tool_call_id: 'b', executionTimeMs: 300, success: true })
	steps = startToolStep(steps, { name: 'generate_chart', params: null, toolCallId: 'c' })
	steps = completeToolStep(steps, {
		name: 'generate_chart',
		tool_call_id: 'c',
		executionTimeMs: 400,
		success: false,
		error: 'no data'
	})
	await draw(steps, false)

	expect(container.querySelector('img')).toBeNull()
	expect(container.querySelectorAll('li')).toHaveLength(0)
	const summary = header()
	expect(summary.textContent).toContain('Queried the database twice and generated a chart')
	expect(summary.textContent).toContain('1 failed')
	expect(summary.textContent).toContain('1s')
	expect(summary.textContent).not.toContain('…')

	await act(async () => summary.click())
	expect(rows()).toEqual([
		'Reasoning : Plan.',
		'Querying database : {"q":"a"} Premium 300ms',
		'Querying database : {"q":"b"} 300ms',
		'Generating visualization : no data 400ms'
	])
	expect(container.querySelectorAll('li button[aria-expanded="true"]')).toHaveLength(0)
	expect(container.textContent).not.toContain('Thinking')

	// A tool row opens to its payload.
	await act(async () => container.querySelectorAll<HTMLButtonElement>('li button')[1].click())
	expect(container.querySelector('li pre')?.textContent).toContain('"q": "a"')
})

test('a restored result with nothing to show is not expandable', async () => {
	const steps: Array<AgentStep> = [
		{
			kind: 'tool',
			id: 'r1',
			toolCallId: null,
			name: 'load_skill',
			label: 'Loading knowledge',
			params: null,
			status: 'done',
			execution: { name: 'load_skill', executionTimeMs: 20, success: true }
		},
		{
			kind: 'tool',
			id: 'r2',
			toolCallId: null,
			name: 'execute_sql',
			label: 'Querying database',
			params: null,
			status: 'done',
			execution: { name: 'execute_sql', executionTimeMs: 20, success: true, resultCount: 3 }
		}
	]
	await draw(steps, false)
	await act(async () => header().click())
	// A row with nothing to show is plain text, not a button that does nothing.
	expect(rows()).toHaveLength(2)
	const rowButtons = [...container.querySelectorAll<HTMLButtonElement>('li button')]
	expect(rowButtons.map((b) => b.getAttribute('aria-expanded'))).toEqual(['false'])
	expect(container.querySelector('li .select-text')).toBeNull()
	await act(async () => rowButtons[0].click())
	expect(container.querySelector('li .select-text')?.textContent).toContain('3 results')
})

test('the list follows its end only until the reader scrolls up, and again once they come back near it', async () => {
	let steps: Array<AgentStep> = appendReasoning([], 'x\n'.repeat(40))
	await draw(steps, true)
	const list = container.querySelector('ol')!
	// happy-dom has no layout; stand in for a list taller than its box.
	Object.defineProperty(list, 'clientHeight', { value: 320, configurable: true })
	let height = 1000
	Object.defineProperty(list, 'scrollHeight', { get: () => height, configurable: true })
	let top = 0
	Object.defineProperty(list, 'scrollTop', {
		get: () => top,
		set: (value: number) => {
			top = Math.min(value, height - 320)
		},
		configurable: true
	})

	// Growth while following pins the end.
	steps = appendReasoning(steps, 'y')
	height = 1100
	await draw(steps, true)
	expect(top).toBe(780)
	// The pin's own scroll event does not count as the reader scrolling.
	await act(async () => list.dispatchEvent(new Event('scroll')))

	// The reader scrolls up: growth no longer moves them.
	top = 400
	await act(async () => list.dispatchEvent(new Event('scroll')))
	steps = appendReasoning(steps, 'z')
	height = 1300
	await draw(steps, true)
	expect(top).toBe(400)

	// They come back to within a few lines of a moving bottom: following resumes.
	top = 1300 - 320 - 30
	await act(async () => list.dispatchEvent(new Event('scroll')))
	steps = appendReasoning(steps, 'w')
	height = 1500
	await draw(steps, true)
	expect(top).toBe(1180)
})

test('renders nothing for a finished message with no steps', async () => {
	await draw([], false)
	expect(container.innerHTML).toBe('')
})

test.each(['live', 'completed', 'restored'] as const)(
	'%s SQL details follow permission changes without hiding result counts',
	async (phase) => {
		const query = 'SELECT name FROM protocols'
		const execution: ToolExecution = {
			name: 'execute_sql',
			tool_call_id: 'sql1',
			executionTimeMs: 20,
			success: true,
			sqlQuery: query
		}
		let steps = startToolStep([], { name: 'execute_sql', toolCallId: 'sql1', params: { query } })
		if (phase === 'completed') steps = completeToolStep(steps, execution)
		if (phase === 'restored')
			steps = stepsForMessage(
				mapPersistedMessage({
					role: 'assistant',
					metadata: { toolExecutions: [execution] }
				})
			)
		const render = (showToolDetails: boolean) =>
			act(async () =>
				root.render(<AgentTimeline steps={steps} streaming={phase === 'live'} showToolDetails={showToolDetails} />)
			)
		await render(false)
		if (phase !== 'live') await act(async () => header().click())
		const rowButton = () => container.querySelector<HTMLButtonElement>('li button')
		expect(container.textContent).not.toContain(query)
		// Without permission the row has nothing to open, so it is not a button at all.
		expect(rowButton()).toBeNull()
		expect(container.querySelector('li pre')).toBeNull()

		await render(true)
		expect(container.textContent).toContain(query)
		await act(async () => rowButton()!.click())
		expect(container.querySelector('li pre')?.textContent).toContain(query)

		// A permission change must also remove details that were already open.
		await render(false)
		expect(container.textContent).not.toContain(query)
		expect(container.querySelector('li pre')).toBeNull()
		expect(rowButton()).toBeNull()

		steps = steps.map((step) =>
			step.kind === 'tool'
				? {
						...step,
						execution: { ...execution, resultCount: 3 }
					}
				: step
		)
		await render(false)
		expect(container.textContent).toContain('3 results')
		expect(rowButton().hasAttribute('aria-expanded')).toBe(true)
		expect(container.textContent).not.toContain(query)
	}
)
