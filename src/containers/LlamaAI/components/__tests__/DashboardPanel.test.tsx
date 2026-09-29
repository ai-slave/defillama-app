// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { DashboardArtifact } from '~/containers/LlamaAI/types'
import { accessibleName } from '~/utils/testing/accessibleName'
import { fixtureStatus } from '~/utils/testing/fixtureFetch'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'

const { toastError, push } = vi.hoisted(() => ({ toastError: vi.fn(), push: vi.fn() }))
// The toast library is the app's notification boundary; its calls are what a user would see.
vi.mock('react-hot-toast', () => ({ default: { error: toastError } }))
vi.mock('next/router', () => ({ default: { push }, useRouter: () => ({ push, query: {} }) }))
// Heavy child; these tests only read the save flow around the grid.
vi.mock('~/containers/ProDashboard/components/ChartGrid', () => ({ ChartGrid: () => null }))

import { DashboardPanel } from '../DashboardPanel'

const session = installSubscriberSession('owner', { resolved: true })
const SAVE = '/api/private/pro-dashboard/save'
const premiumDashboard = {
	id: 'd1',
	dashboardName: 'Yields',
	items: [{ id: 'i1', kind: 'llamaai-chart', chartRef: 'c1' }],
	artifactOutcomes: [
		{
			itemId: 'i1',
			chartRef: 'c1',
			artifactId: 'art1',
			versionId: 'v1',
			status: 'live',
			containsPremium: true,
			estimatedMaxCostUsd: 0.012
		}
	]
} as DashboardArtifact
let root: Root

beforeEach(async () => {
	vi.clearAllMocks()
	// The dashboard provider lists the reader's dashboards on mount.
	session.serve({
		'https://features.llama.fi/dashboards': { items: [] },
		'https://features.llama.fi/lite/dashboards': { items: [] }
	})
	const container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
	await act(async () =>
		root.render(
			<session.Wrapper>
				<DashboardPanel
					config={premiumDashboard}
					isOpen
					versions={[premiumDashboard]}
					versionIndex={0}
					onVersionChange={vi.fn()}
					onClose={vi.fn()}
					onExited={vi.fn()}
				/>
			</session.Wrapper>
		)
	)
})
afterEach(async () => {
	await act(async () => root.unmount())
	document.body.innerHTML = ''
})

// The panel and its cost confirmation both have a "Create dashboard" button; an open dialog is where the reader acts.
function button(name: string) {
	const scope = document.querySelector('[role="dialog"]') ?? document
	const found = [...scope.querySelectorAll('button')].find((el) => accessibleName(el) === name)
	expect(found, `button ${name}`).not.toBeUndefined()
	return found!
}
async function click(name: string) {
	await act(async () => button(name).click())
}
const saves = () => session.requests.filter((request) => request.url.pathname === SAVE)

test('premium data states its refresh cost before saving, and Cancel saves nothing', async () => {
	await click('Create dashboard')
	expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
		'Daily refreshes will bill your account up to $0.012 per refresh window.'
	)
	await click('Cancel')
	await act(async () => {
		await waitForUi(() => expect(document.querySelector('[role="dialog"]')).toBeNull())
	})
	expect(saves()).toEqual([])
	expect(toastError).not.toHaveBeenCalled()
})

test('a failed premium save stays in the confirmation as a plain sentence', async () => {
	session.serve({ [SAVE]: fixtureStatus(500, { error: 'Database unavailable' }) })
	await click('Create dashboard')
	await click('Create dashboard')
	await act(async () => {
		await waitForUi(() =>
			expect(document.querySelector('[role="alert"]')?.textContent).toBe("Couldn't create the dashboard. Try again.")
		)
	})
	expect(saves()).toHaveLength(1)
	expect(document.querySelector('[role="dialog"]')).not.toBeNull()
	expect(toastError).not.toHaveBeenCalled()
	expect(push).not.toHaveBeenCalled()
})

test('a plain save that fails after the panel has closed still says so', async () => {
	const failure = Promise.withResolvers<Response>()
	session.serve({ [SAVE]: () => failure.promise })
	const plain = { ...premiumDashboard, artifactOutcomes: [] } as DashboardArtifact
	const panel = (config: DashboardArtifact | null) => (
		<session.Wrapper>
			<DashboardPanel
				config={config}
				isOpen={config !== null}
				versions={config ? [config] : []}
				versionIndex={0}
				onVersionChange={vi.fn()}
				onClose={vi.fn()}
				onExited={vi.fn()}
			/>
		</session.Wrapper>
	)
	await act(async () => root.render(panel(plain)))
	await click('Create dashboard')
	await waitForUi(() => expect(saves()).toHaveLength(1))
	await act(async () => root.render(<div />))

	await act(async () => failure.resolve(new Response(null, { status: 500 })))
	await waitForUi(() => expect(toastError).toHaveBeenCalledWith("Couldn't create the dashboard. Try again."))
})

test('a premium save that fails after the panel is gone still says so', async () => {
	const failure = Promise.withResolvers<Response>()
	session.serve({ [SAVE]: () => failure.promise })
	await click('Create dashboard')
	await click('Create dashboard')
	await waitForUi(() => expect(saves()).toHaveLength(1))
	// A route change removes the panel, and its confirmation with it, while the save runs.
	await act(async () => root.render(<div />))

	await act(async () => failure.resolve(new Response(null, { status: 500 })))
	await waitForUi(() => expect(toastError).toHaveBeenCalledWith("Couldn't create the dashboard. Try again."))
})
