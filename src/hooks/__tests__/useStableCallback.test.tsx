// @vitest-environment happy-dom

import { act, useEffect, useLayoutEffect } from 'react'
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
