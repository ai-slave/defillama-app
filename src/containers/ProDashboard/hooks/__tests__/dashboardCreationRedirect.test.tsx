// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

// Hoisted so the Router singleton mock can hold them directly: vi.mock factories run before the file.
const { push, createDashboard } = vi.hoisted(() => ({ push: vi.fn(), createDashboard: vi.fn() }))

vi.mock('next/router', () => ({ default: { pathname: '/dexs', push }, useRouter: () => ({ pathname: '/dexs', push }) }))
vi.mock('~/auth', () => ({
	useAuthContext: () => ({ authorizedFetch: vi.fn(), isAuthenticated: true, user: { id: 'u1' } })
}))
vi.mock('../../services/DashboardAPI', () => ({
	dashboardAPI: { createDashboard: (...a: Array<unknown>) => createDashboard(...a) },
	dashboardUrlKey: (dashboard: { id: string; slug?: string }) => dashboard.slug || dashboard.id
}))
vi.mock('react-hot-toast', () => ({
	default: { success: vi.fn(), error: vi.fn(), loading: vi.fn(() => 't1'), dismiss: vi.fn() }
}))

import { useDashboardCreation } from '../useDashboardCreation'

function Button() {
	const { createDashboardWithDataset } = useDashboardCreation()
	return (
		<button type="button" onClick={createDashboardWithDataset}>
			Create
		</button>
	)
}

describe('creating a dashboard from a dataset page', () => {
	let container: HTMLDivElement
	let root: Root
	let client: QueryClient

	function render(node: React.ReactNode) {
		return act(async () => {
			root.render(<QueryClientProvider client={client}>{node}</QueryClientProvider>)
		})
	}

	const settle = () => act(async () => void (await new Promise((resolve) => setTimeout(resolve, 0))))

	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		vi.clearAllMocks()
		client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
	})

	afterEach(() => {
		container.remove()
	})

	test('it redirects to the new dashboard', async () => {
		createDashboard.mockResolvedValue({ id: 'd1', slug: 'dex-volume' })
		await render(<Button />)
		await act(async () => container.querySelector('button')!.click())
		await settle()
		expect(push).toHaveBeenCalledWith('/pro/dex-volume')
		await act(async () => root.unmount())
	})

	test('a reader who leaves first is not pulled to the new dashboard', async () => {
		let finish: (value: { id: string; slug: string }) => void = () => {}
		createDashboard.mockImplementation(() => new Promise((resolve) => (finish = resolve)))
		await render(<Button />)
		await act(async () => container.querySelector('button')!.click())

		await act(async () => root.unmount())
		await act(async () => {
			finish({ id: 'd1', slug: 'dex-volume' })
			await new Promise((resolve) => setTimeout(resolve, 0))
		})
		expect(push).not.toHaveBeenCalled()
	})
})
