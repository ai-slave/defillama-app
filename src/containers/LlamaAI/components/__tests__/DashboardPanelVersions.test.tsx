// @vitest-environment happy-dom
import { act, useReducer } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { dashboardPanelReducer } from '~/containers/LlamaAI/dashboardPanelState'
import type { DashboardArtifact } from '~/containers/LlamaAI/types'
import { accessibleName } from '~/utils/testing/accessibleName'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { DashboardPanel } from '../DashboardPanel'

const router = vi.hoisted(() => ({ pathname: '/ai/chat', query: {}, push: vi.fn(), replace: vi.fn() }))
vi.mock('next/router', () => ({ default: router, useRouter: () => router }))

const session = installSubscriberSession('owner', { resolved: true })
// Versions of one artifact keep its id and change its items.
const first = {
	id: 'artifact',
	dashboardName: 'Fees',
	items: [{ id: 'note', kind: 'text', content: 'First draft' }]
} as DashboardArtifact
const second = {
	id: 'artifact',
	dashboardName: 'Fees',
	items: [{ id: 'note', kind: 'text', content: 'Second draft' }]
} as DashboardArtifact

function Panel() {
	const [state, dispatch] = useReducer(dashboardPanelReducer, {
		isOpen: true,
		mountedConfig: first,
		versions: [first, second],
		versionIndex: 0
	})
	return (
		<DashboardPanel
			config={state.mountedConfig}
			isOpen={state.isOpen}
			versions={state.versions}
			versionIndex={state.versionIndex}
			onVersionChange={(value) => dispatch({ type: 'SELECT_VERSION', value })}
			onClose={() => {}}
			onExited={() => {}}
		/>
	)
}

let root: Root
let container: HTMLDivElement
beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	// Without an observer every card mounts at once, as it does on a browser that lacks one.
	vi.stubGlobal('IntersectionObserver', undefined)
	session.serve({
		'https://features.llama.fi/dashboards': { items: [] },
		'https://features.llama.fi/lite/dashboards': { items: [] }
	})
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	vi.unstubAllGlobals()
})

async function click(name: string) {
	const button = [...container.querySelectorAll('button')].find((candidate) => accessibleName(candidate) === name)
	expect(button, `button ${name}`).not.toBeUndefined()
	await act(async () => button!.click())
}

test('stepping through versions that share an artifact id shows each version’s cards', async () => {
	await act(async () =>
		root.render(
			<session.Wrapper>
				<Panel />
			</session.Wrapper>
		)
	)
	expect(container.textContent).toContain('First draft')

	const next = [...container.querySelectorAll('button')].find(
		(candidate) => accessibleName(candidate) === 'Next version'
	)!
	await act(async () => next.focus())
	await click('Next version')
	expect(container.textContent).toContain('Second draft')
	// The last version disables Next without dropping its focus.
	expect(next.getAttribute('aria-disabled')).toBe('true')
	expect(document.activeElement).toBe(next)
	expect(container.textContent).not.toContain('First draft')

	await click('Previous version')
	expect(container.textContent).toContain('First draft')
	expect(container.textContent).not.toContain('Second draft')
})
