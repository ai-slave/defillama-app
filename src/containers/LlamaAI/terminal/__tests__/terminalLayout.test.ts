// @vitest-environment happy-dom

import { beforeEach, describe, expect, test } from 'vitest'
import pb from '~/utils/pocketbase'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import {
	fetchTerminalLayout,
	getTerminalLayoutSession,
	startTerminalLayoutAutoSave,
	stripAgentSeries,
	type SavableTerminalWidget
} from '../terminalLayout'

/**
 * Indicators, drawings, panes, symbol and interval survive a reload as one TradingView blob. What
 * can lose them is not the chart: it is this write path dropping a state the user already made —
 * a failed PUT treated as stored, an unmount that never flushes, or a widget rebuilt from a server
 * copy that the last save has not reached yet.
 */

const tokenFor = (userId: string) => `e30.${btoa(JSON.stringify({ id: userId, exp: 4_102_444_800 }))}.signature`

function switchAccount(userId: string | null) {
	if (userId === null) pb.authStore.clear()
	else pb.authStore.save(tokenFor(userId), { id: userId, collectionId: '_pb_users_auth_', collectionName: 'users' })
}

const listeners = new Map<string, () => void>()

function fakeWidget(state: () => object): SavableTerminalWidget {
	return {
		save: (callback) => callback(state()),
		subscribe: (_event, callback) => listeners.set('onAutoSaveNeeded', callback)
	}
}

const fixtures = installFixtureFetch()
// Production hands these functions an authorized fetch; the global one reaches the fixtures.
const fetchFn: typeof fetch = (input, init) => fetch(input, init)
let getResponse: () => unknown
let putFails: boolean

const puts = () =>
	fixtures.requests
		.filter((request) => request.init?.method === 'PUT')
		.map((request) => ({ layout: JSON.parse(String(request.init!.body)).layout, keepalive: request.init!.keepalive }))

beforeEach(() => {
	switchAccount(null)
	switchAccount('account-a')
	putFails = false
	getResponse = () => ({ layout: null })
	listeners.clear()
	fixtures.serve({
		'/terminal/layout': (_url: URL, init?: RequestInit) => {
			if (init?.method !== 'PUT') return getResponse()
			if (putFails) throw new Error('network')
			return new Response(null, { status: 204 })
		}
	})
})

const load = async () => ({ session: getTerminalLayoutSession('account-a')! })

// A chart state the strip leaves untouched, so these cases measure the write path alone.
const chartState = (...ids: Array<string>) => ({
	charts: [
		{ panes: [{ sources: [{ type: 'MainSeries', id: '_seriesId' }, ...ids.map((id) => ({ type: 'Study', id }))] }] }
	]
})

describe('terminal layout persistence', () => {
	test('logging out clears private annotations before another account opens the chart', async () => {
		const { session } = await load()
		getResponse = () => ({ layout: chartState('private-a') })
		expect(await fetchTerminalLayout(session, fetchFn)).toEqual(chartState('private-a'))

		switchAccount(null)
		expect(getTerminalLayoutSession('account-a')).toBeNull()
		expect(await fetchTerminalLayout(session, fetchFn)).toBeNull()
		switchAccount('account-b')
		getResponse = () => ({ layout: chartState('private-b') })
		expect(await fetchTerminalLayout(getTerminalLayoutSession('account-b')!, fetchFn)).toEqual(chartState('private-b'))
	})

	test('an old GET cannot repopulate the cache after logout and login to the same account', async () => {
		const { session } = await load()
		let finishGet!: (body: object) => void
		getResponse = () =>
			new Promise<object>((resolve) => {
				finishGet = resolve
			})
		const pending = fetchTerminalLayout(session, fetchFn)
		await Promise.resolve()
		switchAccount(null)
		switchAccount('account-a')
		const nextSession = getTerminalLayoutSession('account-a')!
		// The panel rebuilds its widget when the session object changes, even for the same account.
		expect(nextSession).not.toBe(session)
		finishGet({ layout: chartState('old-login') })
		expect(await pending).toBeNull()
		getResponse = () => ({ layout: chartState('new-login') })
		expect(await fetchTerminalLayout(nextSession, fetchFn)).toEqual(chartState('new-login'))
	})

	test('old widget callbacks and cleanup cannot save using the replacement account', async () => {
		const { session } = await load()
		let finishSave!: (state: object) => void
		const widget = fakeWidget(() => chartState('private-a'))
		widget.save = (callback) => {
			finishSave = callback
		}
		const dispose = startTerminalLayoutAutoSave(session, widget, fetchFn)
		listeners.get('onAutoSaveNeeded')!()
		switchAccount('account-b')
		finishSave(chartState('private-a'))
		listeners.get('onAutoSaveNeeded')!()
		dispose()
		await Promise.resolve()
		expect(puts()).toHaveLength(0)
		getResponse = () => ({ layout: chartState('private-b') })
		expect(await fetchTerminalLayout(getTerminalLayoutSession('account-b')!, fetchFn)).toEqual(chartState('private-b'))
	})

	test('account changes abort pending requests and prevent new requests from old sessions', async () => {
		const { session } = await load()
		await fetchTerminalLayout(session, fetchFn)
		startTerminalLayoutAutoSave(
			session,
			fakeWidget(() => chartState('private-a')),
			fetchFn
		)
		listeners.get('onAutoSaveNeeded')!()
		expect(fixtures.requests).toHaveLength(2)
		const signals = fixtures.requests.map((request) => request.init!.signal!)
		expect(signals.map((signal) => signal.aborted)).toEqual([false, false])
		switchAccount(null)
		expect(signals.map((signal) => signal.aborted)).toEqual([true, true])
		expect(await fetchTerminalLayout(session, fetchFn)).toBeNull()
		listeners.get('onAutoSaveNeeded')!()
		expect(fixtures.requests).toHaveLength(2)
	})

	test('a same-account auth refresh preserves the layout and ongoing saves', async () => {
		const { session } = await load()
		const dispose = startTerminalLayoutAutoSave(
			session,
			fakeWidget(() => chartState('unsaved')),
			fetchFn
		)
		switchAccount('account-a')
		dispose()
		expect(getTerminalLayoutSession('account-a')).toBe(session)
		expect(await fetchTerminalLayout(session, fetchFn)).toEqual(chartState('unsaved'))
		expect(puts()).toEqual([{ layout: chartState('unsaved'), keepalive: true }])
		expect(fixtures.requests[0].init!.signal!.aborted).toBe(false)
	})

	test('a GET finishing after a local save cannot replace the newer layout', async () => {
		const { session } = await load()
		let finishGet!: (body: object) => void
		getResponse = () =>
			new Promise<object>((resolve) => {
				finishGet = resolve
			})
		const pending = fetchTerminalLayout(session, fetchFn)
		await Promise.resolve()
		startTerminalLayoutAutoSave(
			session,
			fakeWidget(() => chartState('newer')),
			fetchFn
		)
		listeners.get('onAutoSaveNeeded')!()
		finishGet({ layout: chartState('older') })
		expect(await pending).toEqual(chartState('newer'))
	})

	test('a failed write is retried by the next save instead of counting as stored', async () => {
		const { session } = await load()
		const layout = chartState()
		startTerminalLayoutAutoSave(
			session,
			fakeWidget(() => layout),
			fetchFn
		)

		putFails = true
		listeners.get('onAutoSaveNeeded')!()
		await new Promise((resolve) => setTimeout(resolve, 0))

		// Nothing about the chart changed, so a path that remembered the attempt would send nothing
		// and the user's layout would be gone at the next reload.
		putFails = false
		listeners.get('onAutoSaveNeeded')!()
		await Promise.resolve()
		expect(puts().map((put) => put.layout)).toEqual([layout, layout])
	})

	test('an unchanged chart is not written again', async () => {
		const { session } = await load()
		const dispose = startTerminalLayoutAutoSave(
			session,
			fakeWidget(() => chartState()),
			fetchFn
		)

		listeners.get('onAutoSaveNeeded')!()
		await Promise.resolve()
		listeners.get('onAutoSaveNeeded')!()
		dispose()
		await Promise.resolve()

		expect(puts()).toHaveLength(1)
	})

	test('closing the terminal writes the state the last event did not carry', async () => {
		const { session } = await load()
		let state: object = chartState()
		const dispose = startTerminalLayoutAutoSave(
			session,
			fakeWidget(() => state),
			fetchFn
		)

		listeners.get('onAutoSaveNeeded')!()
		await Promise.resolve()

		// An indicator added inside the library's throttle window has no event left to carry it.
		state = chartState('rsi')
		dispose()
		await Promise.resolve()

		// The page may already be unloading, so the request has to outlive the document.
		expect(puts()).toEqual([
			{ layout: chartState(), keepalive: false },
			{ layout: chartState('rsi'), keepalive: true }
		])
	})

	test('a rebuilt widget reads the state this tab produced, not a stale server copy', async () => {
		const { session } = await load()
		const current = chartState('rsi', 'macd', 'ma')
		startTerminalLayoutAutoSave(
			session,
			fakeWidget(() => current),
			fetchFn
		)
		listeners.get('onAutoSaveNeeded')!()
		await Promise.resolve()

		// The theme toggle rebuilds the widget while the PUT may still be in flight; answering from
		// the server here hands back the layout as it was before the last three indicators.
		getResponse = () => ({ layout: chartState() })
		expect(await fetchTerminalLayout(session, fetchFn)).toEqual(current)
	})

	test('a server answer that is not a chart state is refused', async () => {
		const { session } = await load()
		// saved_data is handed straight to the widget constructor; a string or an array there
		// breaks the chart instead of falling back to a default one.
		for (const bad of [null, 'state', ['charts'], 7]) {
			getResponse = () => ({ layout: bad })
			expect(await fetchTerminalLayout(session, fetchFn), JSON.stringify(bad)).toBeNull()
		}
	})
})

/**
 * A study has no `disableSave`, unlike a shape, so an agent series plotted as a `DefiLlama` study
 * bound to a private `LLAMAAI:` ticker would be written into the layout and restored as a pane
 * pointing at points that no longer exist. The pane shape below is what the library actually
 * emits: one source per study, a study in its own pane being that pane's only source.
 */
interface FixtureSource {
	type: string
	id: string
	state?: { inputs: Record<string, string> }
}
interface FixtureBlob {
	charts: Array<{ panes: Array<{ stretchFactor: number; sources: Array<FixtureSource> }> }>
}

const symbolInput = (ticker: string) => `=${JSON.stringify({ session: '24x7', symbol: ticker })}`
const study = (id: string, ticker: string): FixtureSource => ({
	type: 'Study',
	id,
	state: { inputs: { source: symbolInput(ticker) } }
})

const blobWithAgentSeries = (loneTicker = 'LLAMAAI:op_7f3a.1'): FixtureBlob => ({
	charts: [
		{
			panes: [
				{
					stretchFactor: 700,
					sources: [
						{ type: 'MainSeries', id: '_seriesId' },
						study('a', 'DEFILLAMA:protocol/aave/tvl'),
						study('b', 'LLAMAAI:op_7f3a.0')
					]
				},
				{ stretchFactor: 300, sources: [study('c', 'DEFILLAMA:protocol/aave/fees')] },
				{ stretchFactor: 300, sources: [study('d', loneTicker)] }
			]
		}
	]
})

const sourceIds = (blob: FixtureBlob) =>
	blob.charts[0].panes.map((pane) => pane.sources.map((source) => source.id).join(','))

describe('the agent’s own series never reach the saved layout', () => {
	test('an agent series is dropped, and so is the pane it was alone in', async () => {
		// The overlaid one leaves the price pane; the one in its own pane takes the pane with it,
		// because restoring an empty pane is the stale-ghost bug this exists to prevent.
		expect(sourceIds(stripAgentSeries(blobWithAgentSeries()))).toEqual(['_seriesId,a', 'c'])
	})

	test('a real DefiLlama series is never mistaken for one', () => {
		expect(sourceIds(stripAgentSeries(blobWithAgentSeries('DEFILLAMA:chain/solana/tvl')))).toEqual([
			'_seriesId,a',
			'c',
			'd'
		])
	})

	test('the state that is written is the stripped one, not the raw chart', async () => {
		const { session } = await load()
		startTerminalLayoutAutoSave(
			session,
			fakeWidget(() => blobWithAgentSeries()),
			fetchFn
		)
		listeners.get('onAutoSaveNeeded')!()
		await Promise.resolve()

		expect(puts().map((put) => sourceIds(put.layout))).toEqual([['_seriesId,a', 'c']])
	})
})
