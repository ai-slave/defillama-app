// @vitest-environment happy-dom
import { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { SessionAliasProvider, useOptionalSessionAliases } from '../SessionAliasRegistry'

let container: HTMLDivElement
let root: Root
let resolve: (id: string) => string

/** Registers the fake id of the user's first chat once its real id arrives, as the chat does after its first reply. */
function Chat({ realId }: { realId: string | null }) {
	const aliases = useOptionalSessionAliases()!
	resolve = aliases.resolve
	useEffect(() => {
		if (realId) aliases.register('fake-1', realId)
	}, [aliases, realId])
	return null
}

const render = (userId: string | null, realId: string | null) =>
	act(async () =>
		root.render(
			<SessionAliasProvider userId={userId}>
				<Chat realId={realId} />
			</SessionAliasProvider>
		)
	)

beforeEach(() => {
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

test('an alias resolves for the user who registered it and not for the next one', async () => {
	await render('alice', null)
	await render('alice', 'session-a')
	expect(resolve('fake-1')).toBe('session-a')

	await render('bob', null)
	expect(resolve('fake-1')).toBe('fake-1')

	await render('alice', null)
	expect(resolve('fake-1')).toBe('fake-1')
})

test('an alias registered in the commit that switches user resolves for the new user', async () => {
	await render('alice', null)

	await render('bob', 'session-b')

	expect(resolve('fake-1')).toBe('session-b')
})
