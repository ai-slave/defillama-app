// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { useCountUp } from '../useCountUp'

const reducedMotion = vi.hoisted(() => ({ enabled: false }))
vi.mock('~/hooks/usePrefersReducedMotion', () => ({ prefersReducedMotion: () => reducedMotion.enabled }))

let root: Root
let container: HTMLDivElement
const rendered: Array<number | null | undefined> = []

function Harness({ value, enabled }: { value: number | null; enabled: boolean }) {
	const displayValue = useCountUp(value, { enabled, duration: 400 })
	rendered.push(displayValue)
	return <p>{displayValue ?? '-'}</p>
}

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] })
	reducedMotion.enabled = false
	rendered.length = 0
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	vi.useRealTimers()
})

async function advanceFrames(count: number) {
	await act(async () => {
		vi.advanceTimersByTime(count * 16)
	})
}

test('a value arriving after nothing counts up to it and lands exactly on target', async () => {
	await act(async () => root.render(<Harness value={null} enabled />))
	expect(rendered.at(-1)).toBeNull()

	await act(async () => root.render(<Harness value={200} enabled />))
	expect(rendered.at(-1)).toBe(120)

	await advanceFrames(5)
	const midway = rendered.at(-1)!
	expect(midway).toBeGreaterThan(120)
	expect(midway).toBeLessThan(200)

	await advanceFrames(30)
	expect(rendered.at(-1)).toBe(200)
})

test('a value present on the first render never animates', async () => {
	await act(async () => root.render(<Harness value={42} enabled />))
	expect(rendered).toEqual([42])

	await advanceFrames(10)
	expect(rendered.at(-1)).toBe(42)
})

test('a disabled count-up and reduced motion both show the value straight away', async () => {
	await act(async () => root.render(<Harness value={null} enabled={false} />))
	await act(async () => root.render(<Harness value={900} enabled={false} />))
	expect(rendered.at(-1)).toBe(900)

	reducedMotion.enabled = true
	rendered.length = 0
	await act(async () => root.render(<Harness value={null} enabled />))
	await act(async () => root.render(<Harness value={700} enabled />))
	expect(rendered.at(-1)).toBe(700)
})
