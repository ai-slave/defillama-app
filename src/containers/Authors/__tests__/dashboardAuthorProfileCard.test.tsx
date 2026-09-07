// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, type ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { PublicDashboardAuthor } from '../types'

const getMyDashboardAuthorProfile = vi.fn()

vi.mock('../api', () => ({
	getMyDashboardAuthorProfile: (...args: Array<unknown>) => getMyDashboardAuthorProfile(...args),
	updateMyDashboardAuthorProfile: vi.fn()
}))
vi.mock('~/auth', () => ({
	useAuthContext: () => ({ authorizedFetch: vi.fn(), isAuthenticated: true, loaders: { userLoading: false } })
}))
vi.mock('~/containers/Articles/upload/ImageUploadButton', () => ({ ImageUploadButton: () => null }))

import { DashboardAuthorProfileCard } from '../DashboardAuthorProfileCard'

const profile: PublicDashboardAuthor = {
	slug: 'ada',
	displayName: 'Ada Lovelace',
	bio: 'Writes about analytical engines.',
	avatarUrl: '',
	socials: { twitter: 'https://x.com/ada' },
	createdAt: '2025-01-01T00:00:00.000Z',
	updatedAt: '2026-01-01T00:00:00.000Z'
} as PublicDashboardAuthor

describe('the dashboard author profile card', () => {
	let container: HTMLDivElement
	let root: Root
	let client: QueryClient

	function render(element: ReactElement) {
		return act(async () => {
			root.render(<QueryClientProvider client={client}>{element}</QueryClientProvider>)
		})
	}

	// The card renders from a query, so the render has to settle before the assertions.
	function settle() {
		return act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 0))
		})
	}

	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		getMyDashboardAuthorProfile.mockReset()
		client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
	})

	test('a failed load shows the error card instead of spinning forever', async () => {
		getMyDashboardAuthorProfile.mockRejectedValue(new Error('nope'))
		await render(<DashboardAuthorProfileCard />)
		await settle()
		expect(container.textContent).toContain('Profile could not be loaded.')
	})

	test('a failed background refresh keeps the editor and its unsaved draft', async () => {
		getMyDashboardAuthorProfile.mockResolvedValueOnce(profile)
		await render(<DashboardAuthorProfileCard />)
		await settle()

		const displayName = Array.from(container.querySelectorAll('input')).find((el) => el.value === 'Ada Lovelace')!
		const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
		await act(async () => {
			setValue.call(displayName, 'Ada L. Byron')
			displayName.dispatchEvent(new Event('input', { bubbles: true }))
		})

		// A refetch that fails leaves the previous profile in the cache, so the edit must survive it.
		getMyDashboardAuthorProfile.mockRejectedValueOnce(new Error('offline'))
		await act(async () => {
			await client.refetchQueries({ queryKey: ['dashboard-author-profile'] }).catch(() => {})
		})
		await settle()

		expect(container.textContent).not.toContain('Profile could not be loaded.')
		const values = Array.from(container.querySelectorAll('input')).map((input) => input.value)
		expect(values).toContain('Ada L. Byron')

		// Recovering with the same saved profile must not quietly replace the draft either.
		getMyDashboardAuthorProfile.mockResolvedValueOnce(profile)
		await act(async () => {
			await client.refetchQueries({ queryKey: ['dashboard-author-profile'] })
		})
		await settle()
		expect(Array.from(container.querySelectorAll('input')).map((el) => el.value)).toContain('Ada L. Byron')
	})

	test('the form opens on the loaded profile', async () => {
		getMyDashboardAuthorProfile.mockResolvedValue(profile)
		await render(<DashboardAuthorProfileCard />)
		await settle()

		const values = Array.from(container.querySelectorAll('input')).map((input) => input.value)
		expect(values).toContain('Ada Lovelace')
		expect(values).toContain('ada')
		expect(container.querySelector('textarea')?.value).toBe('Writes about analytical engines.')
	})
})
