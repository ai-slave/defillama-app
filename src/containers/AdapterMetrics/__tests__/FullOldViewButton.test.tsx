// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, test, vi } from 'vitest'
import { useAuthContext } from '~/auth'
import { installSubscriberSession } from '~/utils/test/subscriberSession'
import { FullOldViewButton } from '../FullOldViewButton'

const { push } = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('next/router', () => ({
	default: { pathname: '/dexs', push },
	useRouter: () => ({ pathname: '/dexs', query: {} })
}))
const { Wrapper, serve, requests } = installSubscriberSession('subscriber')
function ReadyButton() {
	return useAuthContext().hasActiveSubscription ? <FullOldViewButton /> : null
}

test('opens feature help without creating a dashboard, then creates the selected dataset on the action', async () => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	const saves: Array<{ data: { dashboardName: string; items: Array<{ kind: string; activePresetId: string }> } }> = []
	serve({
		'/api/private/pro-dashboard/save': (_url: URL, init?: RequestInit) => {
			const body = JSON.parse(init!.body as string)
			saves.push(body)
			return { id: 'created', data: body.data, created: '2026-01-01', updated: '2026-01-01' }
		}
	})
	const container = document.createElement('div')
	document.body.append(container)
	const root = createRoot(container)
	try {
		await act(async () =>
			root.render(
				<Wrapper>
					<ReadyButton />
				</Wrapper>
			)
		)
		await vi.waitFor(() => expect(container.querySelector('[aria-label="What Full View includes"]')).not.toBeNull())
		await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="What Full View includes"]')!.click())
		await vi.waitFor(() => expect(document.body.textContent).toContain('Full View includes:'))
		expect(saves).toHaveLength(0)
		const action = [...container.querySelectorAll('button')].find((button) =>
			button.textContent?.includes('Open in Dashboard')
		)!
		await act(async () => action.click())
		await vi.waitFor(() => expect(push).toHaveBeenCalledWith('/pro/created'))
		expect(saves).toHaveLength(1)
		expect(saves[0]!.data).toMatchObject({
			dashboardName: 'DEX Volume Dashboard',
			items: [{ kind: 'unified-table', activePresetId: 'volume-protocols' }]
		})
		expect(requests.find((request) => request.url.pathname === '/api/private/pro-dashboard/save')!.init!.method).toBe(
			'POST'
		)
	} finally {
		await act(async () => root.unmount())
		container.remove()
	}
})
