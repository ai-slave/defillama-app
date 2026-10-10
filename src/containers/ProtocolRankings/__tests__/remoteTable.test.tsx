// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { TvlSettingsKey } from '~/contexts/LocalStorage'
import type { TablePageRequestResult } from '~/hooks/useTablePages'
import { useRemoteProtocolRankingsTable } from '../remoteTable'
import type { ProtocolRankingInitialPage } from '../tableQuery'
import type { IProtocol } from '../types'

const protocol = { id: 'protocol-1', name: 'Protocol 1', slug: 'protocol-1' } as IProtocol
const initialPage = {
	nextCursor: 'next',
	snapshot: 'abcdefghijklmnopqrst',
	total: 2,
	hasMore: true,
	availableActivityMetrics: [],
	tvlQuickPicks: []
} satisfies ProtocolRankingInitialPage

type HookResult = ReturnType<typeof useRemoteProtocolRankingsTable>
type PendingRequest = { resolve: (response: Response) => void }

function Harness({
	sort,
	onRender,
	onRequestSettled
}: {
	sort: string
	onRender: (result: HookResult) => void
	onRequestSettled: (result: TablePageRequestResult) => void
}) {
	onRender(
		useRemoteProtocolRankingsTable({
			enabled: true,
			chain: 'All',
			initialRows: [protocol],
			initialPage,
			nameSearch: '',
			minTvl: null,
			maxTvl: null,
			sorting: [{ id: sort, desc: true }],
			customColumns: [],
			extraTvlsEnabled: {} as Record<TvlSettingsKey, boolean>,
			exportColumns: [],
			exportFilename: 'protocols.csv',
			onRequestSettled
		})
	)
	return null
}

describe('remote protocol ranking errors', () => {
	let container: HTMLDivElement
	let root: Root
	let latest: HookResult
	let pending: Array<PendingRequest>
	let onRequestSettled: (result: TablePageRequestResult) => void

	const render = async (sort: string) => {
		await act(async () => {
			root.render(<Harness sort={sort} onRender={(result) => (latest = result)} onRequestSettled={onRequestSettled} />)
		})
	}

	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
		pending = []
		onRequestSettled = vi.fn()
		vi.stubGlobal(
			'IntersectionObserver',
			class {
				observe() {}
				disconnect() {}
			}
		)
		vi.stubGlobal(
			'fetch',
			vi.fn(
				() =>
					new Promise<Response>((resolve) => {
						pending.push({ resolve })
					})
			)
		)
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
		vi.unstubAllGlobals()
	})

	test('reports a replacement request failure', async () => {
		await render('fees_24h')
		expect(pending).toHaveLength(1)

		await act(async () => pending[0]?.resolve({ ok: false, status: 403 } as Response))

		expect(latest.error).toBe('replace')
		expect(latest.rows).toEqual([protocol])
		expect(onRequestSettled).toHaveBeenCalledWith({ mode: 'replace', status: 'error' })
	})

	test('reports an append request failure', async () => {
		await render('tvl')
		act(() => void latest.loadMore())
		expect(pending).toHaveLength(1)

		await act(async () => pending[0]?.resolve({ ok: false, status: 403 } as Response))

		expect(latest.error).toBe('append')
		expect(latest.rows).toEqual([protocol])
		expect(onRequestSettled).toHaveBeenCalledWith({ mode: 'append', status: 'error' })
	})
})
