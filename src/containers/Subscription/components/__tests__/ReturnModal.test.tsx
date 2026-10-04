// @vitest-environment happy-dom
import type { NextRouter } from 'next/router'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { useAuthContext } from '~/auth'
import Subscription from '~/pages/subscription'
import pb from '~/utils/pocketbase'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import { getReturnIntentAction, ReturnModal, withoutReturnUrl } from '../ReturnModal'

const router = vi.hoisted(() => ({
	current: {} as Pick<NextRouter, 'pathname' | 'query' | 'replace' | 'isReady' | 'asPath'>
}))
vi.mock('next/router', () => ({ useRouter: () => router.current }))

const session = installSubscriberSession('returning-subscriber')

const destination = '/downloads?mode=sql'
const signedIn = {
	isAuthenticated: true,
	userLoading: false,
	isNewSignup: false,
	returnUrl: destination,
	handledReturnUrl: undefined
}

describe('return intent after sign-in', () => {
	test('asks a returning visitor whether to go back', () => {
		expect(getReturnIntentAction(signedIn)).toBe('prompt')
	})

	test('drops the destination silently right after signup', () => {
		expect(getReturnIntentAction({ ...signedIn, isNewSignup: true })).toBe('consume')
	})

	test.each([
		{ case: 'signed out', input: { ...signedIn, isAuthenticated: false } },
		{ case: 'the session is loading', input: { ...signedIn, userLoading: true } },
		{ case: 'no destination is in the URL', input: { ...signedIn, returnUrl: undefined } },
		{ case: 'the destination was already handled', input: { ...signedIn, handledReturnUrl: destination } }
	])('does nothing when $case', ({ input }) => {
		expect(getReturnIntentAction(input)).toBe('none')
	})

	test('consuming the intent keeps the other query parameters', () => {
		expect(withoutReturnUrl({ returnUrl: destination, billing: 'yearly', source: 'report' })).toEqual({
			billing: 'yearly',
			source: 'report'
		})
	})
})

describe('ReturnModal', () => {
	let root: Root
	let container: HTMLDivElement
	let onClose: ReturnType<typeof vi.fn<() => void>>

	beforeEach(async () => {
		router.current = {
			pathname: '/subscription',
			asPath: '/subscription',
			isReady: true,
			query: { returnUrl: destination, billing: 'yearly' },
			replace: vi.fn(async () => true)
		}
		onClose = vi.fn()
		container = document.createElement('div')
		document.body.append(container)
		root = createRoot(container)
		await act(async () => root.render(<ReturnModal isOpen onClose={onClose} returnUrl={destination} />))
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
	})

	const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]')!

	test('links back to the destination without consuming it', () => {
		expect(dialog().querySelector('a')?.getAttribute('href')).toBe(destination)
		expect(router.current.replace).not.toHaveBeenCalled()
	})

	test.each(['Stay on this page', 'Escape'])('%s consumes the return intent', async (action) => {
		await act(async () => {
			if (action === 'Escape') {
				dialog().focus()
				dialog().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
			} else {
				Array.from(dialog().querySelectorAll('button'))
					.find((button) => button.textContent === action)!
					.click()
			}
		})

		expect(router.current.replace).toHaveBeenCalledExactlyOnceWith(
			{ pathname: '/subscription', query: { billing: 'yearly' } },
			undefined,
			{ shallow: true }
		)
		expect(onClose).toHaveBeenCalled()
	})
})

describe('the subscription page', () => {
	let root: Root
	let container: HTMLDivElement
	let auth: ReturnType<typeof useAuthContext>
	function AuthProbe() {
		auth = useAuthContext()
		return null
	}
	const page = (
		<session.Wrapper>
			<Subscription />
			<AuthProbe />
		</session.Wrapper>
	)

	beforeEach(() => {
		router.current = {
			pathname: '/subscription',
			asPath: `/subscription?returnUrl=${encodeURIComponent(destination)}`,
			isReady: true,
			query: { returnUrl: destination },
			replace: vi.fn(async () => true)
		}
		session.serve({ '/subscription/trial-available': { trialAvailable: false } })
		container = document.createElement('div')
		document.body.append(container)
		root = createRoot(container)
	})
	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
	})

	test('asks a signed-in visitor whether to return to their destination', async () => {
		await act(async () => root.render(page))
		await waitForUi(async () => {
			await act(async () => {})
			expect(document.querySelector('[role="dialog"] a')?.getAttribute('href')).toBe(destination)
		})
		expect(router.current.replace).not.toHaveBeenCalled()
	})

	test('does not ask again after the visitor stays, even before the URL drops the destination', async () => {
		await act(async () => root.render(page))
		await waitForUi(async () => {
			await act(async () => {})
			expect(document.querySelector('[role="dialog"]')).not.toBeNull()
		})
		const stay = [...document.querySelectorAll('[role="dialog"] button')].find(
			(button) => button.textContent === 'Stay on this page'
		) as HTMLButtonElement
		await act(async () => stay.click())
		await act(async () => root.render(page))
		await waitForUi(() => expect(document.querySelector('[role="dialog"]')).toBeNull())
	})

	test('drops the destination without asking right after signup', async () => {
		const { token, record } = session
		await act(async () => pb.authStore.clear())
		session.serve({ '/auth/signup': { token, user: record } })
		await act(async () => root.render(page))
		await act(async () => {
			await auth.signup({
				email: record.email,
				password: 'password123',
				passwordConfirm: 'password123',
				turnstileToken: 'fixture-token',
				promotionalEmails: 'off',
				signal: new AbortController().signal
			})
		})
		await waitForUi(async () => {
			await act(async () => {})
			expect(router.current.replace).toHaveBeenCalledWith({ pathname: '/subscription', query: {} }, undefined, {
				shallow: true
			})
		})
		await waitForUi(async () => {
			await act(async () => {})
			expect(auth.isNewSignup).toBe(false)
		})
		expect(document.querySelector('[role="dialog"]')).toBeNull()
	})
})
