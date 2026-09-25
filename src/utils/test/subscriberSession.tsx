import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { afterEach, beforeEach } from 'vitest'
import { AuthProvider } from '~/auth'
import { subscriptionStatusQueryKey, type Subscription } from '~/auth/subscriptionStatus'
import pb, { type AuthModel } from '~/utils/pocketbase'
import { fixtureStatus, installFixtureFetch } from './fixtureFetch'

export type SessionAccount = 'signed-out' | 'free' | 'subscriber'

export type SessionOptions = {
	/** Who the reader is. Default: 'subscriber'. */
	account?: SessionAccount
	/** Fields merged into the PocketBase auth record, e.g. `{ flags: { is_llama: true } }`. */
	record?: Partial<AuthModel>
	/**
	 * Seed the account and subscription queries so the first render already sees the final
	 * entitlement. Without it the provider loads both over `fetch`, and gated controls start
	 * in their loading state. Tests that re-serve `/subscription/status` or
	 * `/api/collections/users/auth-refresh` and expect the provider to read them keep the
	 * default. Default: false.
	 */
	resolved?: boolean
}

const activeSubscription = { status: 'active', expires_at: '2100-01-01', type: 'pro' } as Subscription

/**
 * Exercise authenticated UI with a real auth store, provider, and subscription response.
 * Queries do not retry unless a test sets its own defaults.
 */
export function installSubscriberSession(
	userId: string,
	{ account = 'subscriber', record: fields, resolved = false }: SessionOptions = {}
) {
	const http = installFixtureFetch()
	const token = `e30.${btoa(JSON.stringify({ id: userId, exp: 4_102_444_800 }))}.signature`
	const record = {
		id: userId,
		email: 'subscriber@example.com',
		collectionId: '_pb_users_auth_',
		collectionName: 'users',
		verified: true,
		...fields
	}
	let client: QueryClient
	beforeEach(() => {
		localStorage.clear()
		client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
		http.serve({
			'/api/collections/users/auth-refresh': { token, record },
			'/subscription/status':
				account === 'subscriber'
					? { subscription: activeSubscription }
					: fixtureStatus(404, { message: 'No active subscription' })
		})
		if (account === 'signed-out') return
		if (resolved) {
			client.setQueryData(['auth', 'status', userId], record)
			client.setQueryData(subscriptionStatusQueryKey(userId), account === 'subscriber' ? activeSubscription : null)
		}
		pb.authStore.save(token, record)
	})
	afterEach(() => {
		client.clear()
		pb.authStore.clear()
		localStorage.clear()
	})
	return {
		...http,
		/** The signed-in token, also for accounts that start signed out and sign in later. */
		token,
		/** The auth record the session saves and auth-refresh returns. */
		record,
		get client() {
			return client
		},
		Wrapper({ children }: { children: ReactNode }) {
			return (
				<QueryClientProvider client={client}>
					<AuthProvider>{children}</AuthProvider>
				</QueryClientProvider>
			)
		}
	}
}
