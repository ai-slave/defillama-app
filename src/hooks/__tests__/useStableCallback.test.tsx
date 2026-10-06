// @vitest-environment happy-dom

import { act, Suspense, useEffect, useLayoutEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { useStableCallback } from '../useStableCallback'

let container: HTMLDivElement
let root: Root
let seen: Array<string>

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	seen = []
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

/** A child's effects run before its parent's, so the child reads the callback before the parent's effects run. */
function LayoutChild({ report, value }: { report: () => void; value: string }) {
	useLayoutEffect(() => {
		report()
	}, [report, value])
	return null
}

function PassiveChild({ report, value }: { report: () => void; value: string }) {
	useEffect(() => {
		report()
	}, [report, value])
	return null
}

function Parent({ value, phase }: { value: string; phase: 'layout' | 'passive' }) {
	const report = useStableCallback(() => {
		seen.push(value)
	})
	const Child = phase === 'layout' ? LayoutChild : PassiveChild
	return <Child report={report} value={value} />
}

test.each(['layout', 'passive'] as const)(
	'a child calling the callback from its %s effect sees the render it belongs to',
	async (phase) => {
		await act(async () => root.render(<Parent value="first" phase={phase} />))
		await act(async () => root.render(<Parent value="second" phase={phase} />))

		expect(seen).toEqual(['first', 'second'])
	}
)

test('keeps one identity across renders and returns the latest render from its own layout effect', async () => {
	let read: () => string
	function Harness({ value }: { value: string }) {
		read = useStableCallback(() => value)
		useLayoutEffect(() => {
			seen.push(read())
		})
		return null
	}

	await act(async () => root.render(<Harness value="first" />))
	const firstCallback = read!
	await act(async () => root.render(<Harness value="second" />))

	expect(read!).toBe(firstCallback)
	expect(seen).toEqual(['first', 'second'])
})

test('a suspended render does not leak its values into the committed callback', async () => {
	let read: () => string
	const pending = new Promise<void>(() => {})
	function Harness({ value, suspend = false }: { value: string; suspend?: boolean }) {
		const callback = useStableCallback(() => value)
		useLayoutEffect(() => {
			read = callback
		})
		if (suspend) throw pending
		return <span>{value}</span>
	}

	await act(async () =>
		root.render(
			<Suspense fallback="Loading">
				<Harness value="first" />
			</Suspense>
		)
	)
	await act(async () =>
		root.render(
			<Suspense fallback="Loading">
				<Harness value="second" suspend />
			</Suspense>
		)
	)

	expect(read!()).toBe('first')
})
