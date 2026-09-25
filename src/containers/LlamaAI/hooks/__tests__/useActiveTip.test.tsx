// @vitest-environment happy-dom

import { act, useLayoutEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AI_SERVER } from '~/constants'
import pb from '~/utils/pocketbase'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { installUmamiSink } from '~/utils/testing/umamiSink'
import type { TipDTO } from '../useLlamaAISettings'
import { useActiveTip } from '../useLlamaAITip'

const session = installSubscriberSession('user-a')
installUmamiSink()

const tipFor = (id: string): TipDTO => ({ id, variant: 'v', family: 'f' }) as TipDTO
const tokenFor = (id: string) => `e30.${btoa(JSON.stringify({ id, exp: 4_102_444_800 }))}.signature`
const recordFor = (id: string) => ({
	id,
	email: `${id}@example.com`,
	collectionId: '_pb_users_auth_',
	collectionName: 'users',
	verified: true
})

let container: HTMLDivElement
let root: Root
let seen: Array<string | null>
let api: ReturnType<typeof useActiveTip>
// Settings stay pending until a test releases them, so the cached tip is what renders meanwhile.
let serverTip: TipDTO | null | undefined

function Harness() {
	api = useActiveTip()
	// Recorded after commit, not during render: a render-phase re-seed makes React throw the first
	// render away, and only committed values can reach the screen.
	useLayoutEffect(() => {
		seen.push(api.tip?.id ?? null)
	})
	return null
}

async function render() {
	await act(async () =>
		root.render(
			<session.Wrapper>
				<Harness />
			</session.Wrapper>
		)
	)
}

async function signInAs(id: string) {
	await act(async () => pb.authStore.save(tokenFor(id), recordFor(id)))
}

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	serverTip = undefined
	seen = []
	session.serve({
		// Refresh echoes the account whose token asked, so switching accounts sticks.
		'/api/collections/users/auth-refresh': (_url: URL, init?: RequestInit) => {
			const token = new Headers(init?.headers).get('Authorization')!.replace(/^Bearer /, '')
			const id = JSON.parse(atob(token.split('.')[1]!)).id as string
			return { token, record: recordFor(id) }
		},
		[`${AI_SERVER}/user-settings`]: () =>
			serverTip === undefined ? new Promise<never>(() => {}) : { settings: {}, tip: serverTip },
		[`${AI_SERVER}/user-tips/`]: { ok: true }
	})
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

test('shows the cached tip for the signed-in account while settings load', async () => {
	localStorage.setItem('llamaai-last-tip:user-a', JSON.stringify(tipFor('tip-a')))
	await render()
	expect(seen.at(-1)).toBe('tip-a')
})

// Re-seeding in an effect committed the previous account's tip first, so the panel flashed a tip
// belonging to someone else before correcting itself.
test('never renders the previous account tip after the account changes', async () => {
	localStorage.setItem('llamaai-last-tip:user-a', JSON.stringify(tipFor('tip-a')))
	localStorage.setItem('llamaai-last-tip:user-b', JSON.stringify(tipFor('tip-b')))
	await render()
	seen = []

	await signInAs('user-b')

	expect(seen).not.toContain('tip-a')
	expect(seen.at(-1)).toBe('tip-b')
})

test('an account with no cached tip clears the previous one', async () => {
	localStorage.setItem('llamaai-last-tip:user-a', JSON.stringify(tipFor('tip-a')))
	await render()
	await signInAs('user-c')
	expect(seen.at(-1)).toBeNull()
})

// The opposite edge: the re-seed must not resurrect a tip the user dismissed.
test('a dismissed tip stays cleared across later renders', async () => {
	localStorage.setItem('llamaai-last-tip:user-a', JSON.stringify(tipFor('tip-a')))
	await render()
	await act(async () => api.dismissTip(tipFor('tip-a')))
	expect(seen.at(-1)).toBeNull()
	expect(localStorage.getItem('llamaai-last-tip:user-a')).toBeNull()
	expect(session.urls()).toContain(`${AI_SERVER}/user-tips/tip-a/dismiss`)

	await render()
	expect(seen.at(-1)).toBeNull()
})

test('the resolved server tip wins over the cached one', async () => {
	localStorage.setItem('llamaai-last-tip:user-a', JSON.stringify(tipFor('tip-a')))
	serverTip = tipFor('tip-server')
	await render()
	await vi.waitFor(() => expect(seen.at(-1)).toBe('tip-server'))
})
