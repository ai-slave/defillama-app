// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { installUmamiSink } from '~/utils/test/umamiSink'
import { BasicLink } from './Link'

const track = installUmamiSink()
let container: HTMLDivElement
let root: Root

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

test('tracks the Umami event on click without rendering the Umami attributes, and leaves ordinary links untracked', async () => {
	await act(async () =>
		root.render(
			<>
				<BasicLink href="/ai" data-umami-event="llamaai-nav-link" data-umami-event-subscribed="true">
					Ask LlamaAI
				</BasicLink>
				<BasicLink href="/chains">Chains</BasicLink>
			</>
		)
	)

	const [tracked, ordinary] = container.querySelectorAll('a')
	expect(tracked.getAttribute('href')).toBe('/ai')
	expect(tracked.getAttribute('data-umami-event')).toBeNull()
	expect(tracked.getAttribute('data-umami-event-subscribed')).toBeNull()

	await act(async () => tracked.click())
	await act(async () => ordinary.click())

	expect(track.mock.calls).toEqual([['llamaai-nav-link', { subscribed: 'true' }]])
})
