// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Table } from '@tanstack/react-table'
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { RwaTableFeatures } from '../features'
import type { RWATableRow } from '../rows'
import { spotAsset } from './fixtures'

vi.mock('next/router', () => ({
	useRouter: () => ({ query: {}, pathname: '/rwa', asPath: '/rwa', push: vi.fn() })
}))

// The real table virtualizes against window layout, which happy-dom does not measure; render plain rows.
// This covers the toggle wiring; the React Compiler opt-out in RWATable.tsx only shows in the built app.
vi.mock('~/components/Table/VirtualTable', () => ({
	VirtualTable: ({ table: instance }: { table: Table<RwaTableFeatures, RWATableRow> }) => {
		return createElement(
			'table',
			null,
			createElement(
				'tbody',
				null,
				instance.getRowModel().rows.map((row) =>
					createElement(
						'tr',
						{ key: row.id, 'data-depth': row.depth },
						row.getVisibleCells().map((cell) => {
							const { flexRender } = require('@tanstack/react-table')
							return createElement(
								'td',
								{ key: cell.id, 'data-column-id': cell.column.id },
								flexRender(cell.column.columnDef.cell, cell.getContext())
							)
						})
					)
				)
			)
		)
	}
}))

import { RWATable } from '../RWATable'

function tableProps(period: '1d' | '7d' | '1m') {
	return {
		assets: [spotAsset(), spotAsset({ id: 'ousg', canonicalMarketId: 'ondo/ousg', assetName: 'Ondo OUSG' })],
		view: 'assets' as const,
		groupBy: 'platform' as const,
		includeCex: false,
		period,
		onPeriodChange: () => {},
		selectedChain: 'All',
		includeBridgeTvl: true,
		platformLogos: {}
	}
}

describe('RWATable expansion', () => {
	let container: HTMLDivElement
	let root: Root

	beforeEach(() => {
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
	})

	test('opens a platform group when its chevron is clicked', async () => {
		const client = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } })
		await act(async () => {
			root.render(createElement(QueryClientProvider, { client }, createElement(RWATable, tableProps('7d'))))
		})
		expect(container.querySelectorAll('tbody tr')).toHaveLength(1)
		const chevron = container.querySelector<HTMLButtonElement>('tbody tr button[aria-expanded]')!
		expect(chevron.getAttribute('aria-expanded')).toBe('false')
		await act(async () => {
			chevron.click()
		})
		expect(container.querySelector('tbody tr button[aria-expanded]')!.getAttribute('aria-expanded')).toBe('true')
		expect(container.querySelectorAll('tbody tr')).toHaveLength(3)
	})

	test('recomputes the change columns when the period switches and keeps the group open', async () => {
		const client = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } })
		const render = (period: '7d' | '1m') =>
			act(async () => {
				root.render(createElement(QueryClientProvider, { client }, createElement(RWATable, tableProps(period))))
			})
		await render('7d')
		await act(async () => {
			container.querySelector<HTMLButtonElement>('tbody tr button[aria-expanded]')!.click()
		})
		// Name, Chains, Asset Type, Active, Onchain, change
		const changeCell = () => container.querySelectorAll('tbody tr[data-depth="1"] td')[5]?.textContent
		expect(changeCell()).toBe('+14.29%')
		await render('1m')
		expect(changeCell()).toBe('+60.00%')
		expect(container.querySelectorAll('tbody tr')).toHaveLength(3)
	})

	test('hides Chains under Group by Chain and shows the expand-only columns under Group by None', async () => {
		const client = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } })
		// The mock table has no header row; the first body row carries the visible column ids.
		const headerIds = () => {
			const first = container.querySelector('tbody tr')
			return first
				? [...first.querySelectorAll('td[data-column-id]')].map((td) => td.getAttribute('data-column-id'))
				: []
		}
		const render = (groupBy: 'chain' | 'none') =>
			act(async () => {
				root.render(
					createElement(QueryClientProvider, { client }, createElement(RWATable, { ...tableProps('7d'), groupBy }))
				)
			})
		await render('chain')
		expect(headerIds()).toContain('activeMcap')
		expect(headerIds()).not.toContain('chains')
		expect(headerIds()).not.toContain('assetGroup')
		await render('none')
		expect(headerIds()).toContain('assetGroup')
		expect(headerIds()).toContain('price')
		expect(headerIds()).toContain('chains')
	})

	test('paints the compliance preset without the expand-only columns under Group by None', async () => {
		const client = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } })
		const headerIds = () => {
			const first = container.querySelector('tbody tr')
			return first
				? [...first.querySelectorAll('td[data-column-id]')].map((td) => td.getAttribute('data-column-id'))
				: []
		}
		await act(async () => {
			root.render(
				createElement(
					QueryClientProvider,
					{ client },
					createElement(RWATable, { ...tableProps('7d'), groupBy: 'none', preset: 'compliance' })
				)
			)
		})
		// The mock table paints csv-only columns too, so only the painted prefix is asserted.
		expect(headerIds().slice(0, 9)).toEqual([
			'name',
			'issuer',
			'accessModel',
			'attestations',
			'kycForMintRedeem',
			'kycAllowlistedWhitelistedToTransferHold',
			'transferable',
			'selfCustody',
			'redeemable'
		])
		expect(headerIds()).not.toContain('assetGroup')
		expect(headerIds()).not.toContain('price')
		expect(headerIds()).not.toContain('activeMcap')
	})

	test('starts collapsed after a grouping switch, so Asset Type hides again', async () => {
		const client = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } })
		const columnIds = () => {
			const first = container.querySelector('tbody tr')
			return first
				? [...first.querySelectorAll('td[data-column-id]')].map((td) => td.getAttribute('data-column-id'))
				: []
		}
		const render = (groupBy: 'platform' | 'assetGroup') =>
			act(async () => {
				root.render(
					createElement(QueryClientProvider, { client }, createElement(RWATable, { ...tableProps('7d'), groupBy }))
				)
			})
		await render('platform')
		await act(async () => {
			container.querySelector<HTMLButtonElement>('tbody tr button[aria-expanded]')!.click()
		})
		expect(columnIds()).toContain('assetGroup')
		await render('assetGroup')
		expect(container.querySelectorAll('tbody tr')).toHaveLength(1)
		expect(columnIds()).not.toContain('assetGroup')
	})
})
