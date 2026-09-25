// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, test } from 'vitest'
import { useAuthContext } from '~/auth'
import { installSubscriberSession, type SessionOptions } from '../subscriberSession'

type View = { signedIn: boolean; subscribed: boolean; loading: boolean; isLlama: boolean }

async function firstRender(session: ReturnType<typeof installSubscriberSession>) {
	const views: Array<View> = []
	function Probe() {
		const auth = useAuthContext()
		views.push({
			signedIn: auth.isAuthenticated,
			subscribed: auth.hasActiveSubscription,
			loading: auth.loaders.sessionLoading,
			isLlama: auth.user?.flags.is_llama === true
		})
		return null
	}
	const root = createRoot(document.createElement('div'))
	await act(async () =>
		root.render(
			<session.Wrapper>
				<Probe />
			</session.Wrapper>
		)
	)
	await act(async () => root.unmount())
	return views[0]
}

const cases: Array<[string, SessionOptions, View]> = [
	[
		'signed-out',
		{ account: 'signed-out', resolved: true },
		{ signedIn: false, subscribed: false, loading: false, isLlama: false }
	],
	['free', { account: 'free', resolved: true }, { signedIn: true, subscribed: false, loading: false, isLlama: false }],
	['subscriber', { resolved: true }, { signedIn: true, subscribed: true, loading: false, isLlama: false }],
	[
		'subscriber with flags',
		{ resolved: true, record: { flags: { is_llama: true } } },
		{ signedIn: true, subscribed: true, loading: false, isLlama: true }
	]
]

for (const [name, options, expected] of cases) {
	describe(`a resolved ${name} session`, () => {
		const session = installSubscriberSession('reader', options)
		test('shows its final entitlement on the first render without a request', async () => {
			expect(await firstRender(session)).toEqual(expected)
			expect(session.urls()).toEqual([])
		})
	})
}

describe('an unresolved subscriber session', () => {
	const session = installSubscriberSession('reader')
	test('starts loading and reads the account over fetch', async () => {
		expect(await firstRender(session)).toEqual({ signedIn: true, subscribed: false, loading: true, isLlama: false })
		expect(
			session
				.urls()
				.map((url) => new URL(url).pathname)
				.sort()
		).toEqual(['/api/collections/users/auth-refresh', '/subscription/status'])
	})
})
