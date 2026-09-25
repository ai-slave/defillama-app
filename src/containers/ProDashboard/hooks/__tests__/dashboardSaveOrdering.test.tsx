// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { FEATURES_SERVER } from '~/constants'
import { installSubscriberSession } from '~/utils/test/subscriberSession'
import type { DashboardSavePayload } from '../../services/DashboardAPI'
import { useDashboardAPI } from '../useDashboardAPI'
const session = installSubscriberSession('user')
const saves = () => session.requests.filter(({ url }) => url.pathname === '/api/private/pro-dashboard/save')
const saved = (id: string) => ({ id, data: { dashboardName: id, items: [] }, created: '', updated: '' })
vi.mock('next/router', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn() } }))
let root: Root
let container: HTMLDivElement
let save: ReturnType<typeof useDashboardAPI>['updateDashboard']
const payload = (name: string): DashboardSavePayload => ({
	dashboardName: name,
	items: [],
	visibility: 'private',
	tags: [],
	description: ''
})
function Harness({ id }: { id: string }) {
	save = useDashboardAPI(id).updateDashboard
	return null
}
async function mount(id: string) {
	await act(async () =>
		root.render(
			<session.Wrapper>
				<Harness key={id} id={id} />
			</session.Wrapper>
		)
	)
}
beforeEach(() => {
	vi.clearAllMocks()
	session.serve({ [`${FEATURES_SERVER}/dashboards`]: { items: [] } })
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})
test.each(['success', 'failure'] as const)(
	'same-dashboard saves stay ordered across remount after %s',
	async (outcome) => {
		const first = Promise.withResolvers<unknown>()
		const second = Promise.withResolvers<unknown>()
		session.serve({ '/api/private/pro-dashboard/save': () => (saves().length === 1 ? first.promise : second.promise) })
		await mount('a')
		await act(async () => save.mutate({ id: 'a', data: payload('First') }))
		await vi.waitFor(() => expect(saves()).toHaveLength(1))
		await mount('b')
		await mount('a')
		await act(async () => save.mutate({ id: 'a', data: payload('Second') }))
		await vi.waitFor(() => expect(save.isPaused).toBe(true))
		expect(saves()).toHaveLength(1)
		await act(async () => {
			if (outcome === 'success') first.resolve(saved('a'))
			else first.reject(new Error('Offline'))
		})
		await vi.waitFor(() => expect(saves()).toHaveLength(2))
		expect(JSON.parse(saves()[1].init!.body as string).data.dashboardName).toBe('Second')
		await act(async () => second.resolve(saved('a')))
		await vi.waitFor(() => expect(save.isSuccess).toBe(true))
	}
)
test('saving another dashboard does not wait for the current dashboard', async () => {
	const first = Promise.withResolvers<unknown>()
	session.serve({
		'/api/private/pro-dashboard/save': (url: URL) => (url.searchParams.get('id') === 'a' ? first.promise : saved('b'))
	})
	await mount('a')
	await act(async () => save.mutate({ id: 'a', data: payload('First') }))
	await vi.waitFor(() => expect(saves()).toHaveLength(1))
	await mount('b')
	await act(async () => save.mutate({ id: 'b', data: payload('Other') }))
	await vi.waitFor(() => expect(saves()).toHaveLength(2))
	expect(saves().map(({ url }) => url.searchParams.get('id'))).toEqual(['a', 'b'])
	await act(async () => first.resolve(saved('a')))
})
