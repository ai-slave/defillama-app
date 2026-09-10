// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ChatMarkdownRenderer } from './ChatMarkdownRenderer'
import { useStreamReveal } from './useStreamReveal'

let now = 0
let frames: Array<FrameRequestCallback> = []

// Advance the clock in 16ms frames, running whatever the hook scheduled for each one.
async function runFrames(count: number) {
	for (let i = 0; i < count; i++) {
		now += 16
		const time = now
		const queued = frames
		frames = []
		await act(async () => {
			for (const cb of queued) cb(time)
		})
	}
}

let container: HTMLDivElement
let root: Root

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	now = 1000
	frames = []
	vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb))
	vi.stubGlobal('cancelAnimationFrame', (id: number) => {
		frames[id - 1] = () => {}
	})
	vi.spyOn(performance, 'now').mockImplementation(() => now)
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	vi.unstubAllGlobals()
	vi.restoreAllMocks()
})

function Probe({ content, active }: { content: string; active: boolean }) {
	const reveal = useStreamReveal(content, active)
	return <output data-revealing={reveal.revealing}>{reveal.text}</output>
}

const shown = () => container.querySelector('output')!.textContent ?? ''
const revealing = () => container.querySelector('output')!.dataset.revealing === 'true'
const render = (content: string, active: boolean) =>
	act(async () => root.render(<Probe content={content} active={active} />))

test('spreads a chunk over the expected gap instead of showing it at once', async () => {
	const chunk = 'x'.repeat(200)
	await render(chunk, true)
	expect(shown()).toBe('')
	expect(revealing()).toBe(true)

	let previous = 0
	await runFrames(6)
	for (let i = 0; i < 10; i++) {
		await runFrames(1)
		const length = shown().length
		expect(length).toBeGreaterThan(previous)
		previous = length
	}
	// ~270ms in: past the halfway mark of the 500ms default gap, nowhere near complete.
	expect(previous).toBeGreaterThan(80)
	expect(previous).toBeLessThan(150)

	await runFrames(16)
	expect(shown()).toBe(chunk)
	expect(revealing()).toBe(false)
	expect(frames.every((cb) => cb.toString() === '() => {}')).toBe(true)
})

test('speeds up when the stream arrives faster than expected', async () => {
	await render('a'.repeat(100), true)
	await runFrames(12) // ~190ms: ~38 characters shown, 62 pending
	const before = shown().length
	expect(before).toBeGreaterThan(30)
	expect(before).toBeLessThan(50)

	// A second chunk 190ms after the first: the gap estimate drops toward 190ms and the whole
	// backlog, old and new, has to land before the next one is due.
	await render('a'.repeat(100) + 'b'.repeat(100), true)
	await runFrames(1)
	const perFrame = shown().length - before
	expect(perFrame).toBeGreaterThan(4)
	await runFrames(30)
	expect(shown()).toBe('a'.repeat(100) + 'b'.repeat(100))
})

test('shows text in full when it is not a continuation of what was revealed', async () => {
	await render('first draft of the answer', true)
	await runFrames(3)
	expect(shown().length).toBeLessThan(25)

	await render('a rewritten answer', true)
	expect(shown()).toBe('a rewritten answer')
	expect(revealing()).toBe(false)
})

test('renders finished and non-streaming text immediately', async () => {
	await render('a committed message', false)
	expect(shown()).toBe('a committed message')
	expect(revealing()).toBe(false)
	expect(frames).toHaveLength(0)
})

test('drains the remaining text quickly once the stream ends', async () => {
	const text = 'z'.repeat(400)
	await render(text, true)
	await runFrames(3)
	expect(shown().length).toBeLessThan(60)

	await render(text, false)
	expect(revealing()).toBe(true)
	await runFrames(10) // 160ms covers the 150ms drain
	expect(shown()).toBe(text)
	expect(revealing()).toBe(false)
})

test('spaces commits so a costly render stays within its budget while the text keeps advancing', async () => {
	// A 10ms render at a 15% budget earns one commit per ~67ms, so every fifth 16ms frame.
	function Paced({ content }: { content: string }) {
		const reveal = useStreamReveal(content, true, () => 10)
		return <output>{reveal.text}</output>
	}
	await act(async () => root.render(<Paced content={'x'.repeat(400)} />))
	await runFrames(1)
	const first = shown().length
	expect(first).toBeGreaterThan(0)
	const steps: Array<number> = []
	let previous = first
	for (let i = 0; i < 20; i++) {
		await runFrames(1)
		if (shown().length !== previous) steps.push(shown().length - previous)
		previous = shown().length
	}
	expect(steps.length).toBeGreaterThanOrEqual(3)
	expect(steps.length).toBeLessThanOrEqual(5)
	// Each commit reveals the frames it waited for, not one frame's worth.
	expect(Math.min(...steps)).toBeGreaterThan(30)
	await runFrames(40)
	expect(shown()).toBe('x'.repeat(400))
})

test('drops to every other frame while frames arrive late', async () => {
	await render('y'.repeat(600), true)
	// Frames 40ms apart: the thread is busy with something else.
	let previous = shown().length
	let commits = 0
	for (let i = 0; i < 8; i++) {
		now += 40
		const time = now
		const queued = frames
		frames = []
		await act(async () => {
			for (const cb of queued) cb(time)
		})
		if (shown().length !== previous) commits++
		previous = shown().length
	}
	expect(commits).toBeGreaterThanOrEqual(3)
	expect(commits).toBeLessThanOrEqual(5)
})

test('never splits an emoji between frames', async () => {
	const text = '🦙'.repeat(60)
	await render(text, true)
	for (let i = 0; i < 40; i++) {
		await runFrames(1)
		const value = shown()
		expect(/[\uD800-\uDBFF]$/.test(value), `lone high surrogate after ${value.length} characters`).toBe(false)
	}
	expect(shown()).toBe(text)
})

test('the renderer keeps the caret on the trailing text until the reveal catches up', async () => {
	const content = `## Fees\n\n${'Fees rose sharply across every chain this week. '.repeat(6)}`
	const draw = (isStreaming: boolean) =>
		act(async () =>
			root.render(
				<ChatMarkdownRenderer content={content} isStreaming={isStreaming} showStreamingCaret={isStreaming} paceReveal />
			)
		)
	await draw(true)
	await runFrames(4)
	const partial = container.textContent ?? ''
	expect(partial.startsWith('Fees')).toBe(true)
	expect(partial.length).toBeLessThan(content.length)

	// The stream commits while text is still typing out: the caret stays until the text is complete.
	await draw(false)
	expect(container.querySelector('[data-llamaai-caret]')).not.toBeNull()
	await runFrames(12)
	expect(container.querySelector('p')?.textContent).toBe(
		'Fees rose sharply across every chain this week. '.repeat(6).trim()
	)
	expect(container.querySelector('[data-llamaai-caret]')).toBeNull()
})
