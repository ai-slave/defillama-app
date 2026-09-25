import { expect, test } from 'vitest'
import { getServerSideProps } from '../conversationPage'

test('serves New Chat without a session segment', async () => {
	expect(await getServerSideProps({ params: {} })).toEqual({ props: {} })
})

test('serves a conversation opened by its session URL', async () => {
	expect(await getServerSideProps({ params: { sessionId: ['session-a'] } })).toEqual({ props: {} })
})

test('returns 404 for extra conversation path segments', async () => {
	expect(await getServerSideProps({ params: { sessionId: ['session-a', 'extra'] } })).toEqual({ notFound: true })
})
