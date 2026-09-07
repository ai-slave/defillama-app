import type * as Ariakit from '@ariakit/react'
import { flexRender } from '@tanstack/react-table'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, test, vi } from 'vitest'

const { DynamicPaginatedTable, paginatedTableCalls } = vi.hoisted(() => {
	const paginatedTableCalls: Array<{
		pageSizeOptions: ReadonlyArray<number>
		pageSize: number
		renderedNames: Array<string>
	}> = []

	function DynamicPaginatedTable({ table, pageSizeOptions }: any) {
		const rows = table.getRowModel().rows
		const { pageSize } = table.getState().pagination

		paginatedTableCalls.push({
			pageSizeOptions,
			pageSize,
			renderedNames: rows.map((row: any) => row.original.name)
		})

		return (
			<div>
				{rows.map((row: any) => (
					<div key={row.id}>
						{row.getVisibleCells().map((cell: any) => (
							<span key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</span>
						))}
					</div>
				))}
			</div>
		)
	}

	return { DynamicPaginatedTable, paginatedTableCalls }
})

let authState = {
	authorizedFetch: vi.fn(),
	hasActiveSubscription: true,
	isAuthenticated: true,
	loaders: { userLoading: false }
}

let queryState: {
	data?: any
	error?: Error | null
	isLoading: boolean
} = {
	data: [],
	error: null,
	isLoading: false
}

vi.mock('next/router', () => ({
	useRouter: () => ({ asPath: '/token/link' })
}))

vi.mock('@ariakit/react', async (importOriginal) => ({
	...(await importOriginal<typeof Ariakit>()),
	Checkbox: ({ clickOnEnter: _clickOnEnter, onFocusVisible: _onFocusVisible, ...props }: any) => (
		<input type="checkbox" {...props} />
	),
	VisuallyHidden: ({ children }: { children: React.ReactNode }) => <>{children}</>,
	useDialogStore: () => ({ show: vi.fn() })
}))

vi.mock('next/dynamic', () => ({
	default: () => DynamicPaginatedTable
}))

vi.mock('@tanstack/react-query', () => ({
	useQuery: () => queryState
}))

vi.mock('~/components/CsvDownloadButton', () => ({
	CSVDownloadButton: () => <button type="button">download csv</button>
}))

vi.mock('~/components/Link', () => ({
	BasicLink: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
		<a href={href} className={className}>
			{children}
		</a>
	)
}))

vi.mock('~/ui/Loaders', () => ({
	LocalLoader: () => <div>loader</div>
}))

vi.mock('~/ui/Switch', () => ({
	Switch: ({ label }: { label: string }) => <div>{label}</div>
}))

vi.mock('~/components/Table/SortIcon', () => ({
	SortIcon: ({ dir }: { dir: string | boolean }) => <span>{String(dir)}</span>
}))

vi.mock('~/components/Table/utils', () => ({
	prepareTableCsv: vi.fn(() => ({ filename: 'token-usage', rows: [] }))
}))

vi.mock('../deferred/DeferredPaginatedTable', () => ({
	DeferredPaginatedTable: DynamicPaginatedTable
}))

vi.mock('~/components/TokenLogo', () => ({
	TokenLogo: ({ alt }: { alt: string }) => <span>{alt}</span>
}))

vi.mock('~/containers/Subscription/SignInModal', () => ({
	SignInModal: () => <div>sign-in-modal</div>
}))

vi.mock('~/auth', () => ({
	useAuthContext: () => authState
}))

import { TokenUsageSection } from '../TokenUsageSection'
import { buildTokenUsageRows, filterTokenUsageRows } from '../TokenUsageSection.utils'

afterEach(() => {
	authState = {
		authorizedFetch: vi.fn(),
		hasActiveSubscription: true,
		isAuthenticated: true,
		loaders: { userLoading: false }
	}
	queryState = {
		data: [],
		error: null,
		isLoading: false
	}
	paginatedTableCalls.length = 0
	vi.clearAllMocks()
})

describe('TokenUsageSection', () => {
	test('renders token usage rows for subscribers', () => {
		queryState = {
			data: [
				{ name: 'Aave', category: 'Lending', amountUsd: 123_456, slug: 'aave', logo: 'https://example.com/aave.png' }
			],
			error: null,
			isLoading: false
		}

		const html = renderToStaticMarkup(<TokenUsageSection tokenSymbol="link" />)

		expect(html).toContain('Token Usage')
		expect(html).toContain('Aave')
		expect(html).toContain('/protocol/aave')
		expect(html).toContain('Include CEXs')
	})

	test('shows a sign-in gate for unauthenticated users', () => {
		authState = {
			authorizedFetch: vi.fn(),
			hasActiveSubscription: false,
			isAuthenticated: false,
			loaders: { userLoading: false }
		}

		const html = renderToStaticMarkup(<TokenUsageSection tokenSymbol="link" />)

		expect(html).toContain('active subscription')
	})

	test('shows a subscription link for authenticated users without a subscription', () => {
		authState = {
			authorizedFetch: vi.fn(),
			hasActiveSubscription: false,
			isAuthenticated: true,
			loaders: { userLoading: false }
		}

		const html = renderToStaticMarkup(<TokenUsageSection tokenSymbol="link" />)

		expect(html).toContain('/subscription?returnUrl=%2Ftoken%2Flink')
	})

	test('shows an empty state when no usage rows remain', () => {
		const html = renderToStaticMarkup(<TokenUsageSection tokenSymbol="link" />)

		expect(html).toContain('No token usage entries found.')
	})

	test('shows the query error message when the fetch fails', () => {
		queryState = {
			data: [],
			error: new Error('Failed to fetch token usage data'),
			isLoading: false
		}

		const html = renderToStaticMarkup(<TokenUsageSection tokenSymbol="link" />)

		expect(html).toContain('Failed to fetch token usage data')
	})

	test('filters CEX rows unless the embedded CEX toggle is enabled', () => {
		queryState = {
			data: [
				{ name: 'Aave', category: 'Lending', amountUsd: 1 },
				{ name: 'Binance', category: 'CEX', amountUsd: 2 }
			],
			error: null,
			isLoading: false
		}

		const defaultHtml = renderToStaticMarkup(<TokenUsageSection tokenSymbol="link" />)
		const includeCexHtml = renderToStaticMarkup(
			<TokenUsageSection tokenSymbol="link" initialIncludeCentralizedExchanges />
		)

		expect(defaultHtml).toContain('Aave')
		expect(defaultHtml).not.toContain('Binance')
		expect(includeCexHtml).toContain('Binance')
	})

	test('paginates rows by descending usage and honors the initial page size', () => {
		queryState = {
			data: Array.from({ length: 22 }, (_, index) => ({
				name: `Protocol ${index + 1}`,
				category: 'Lending',
				amountUsd: index + 1
			})),
			error: null,
			isLoading: false
		}

		renderToStaticMarkup(<TokenUsageSection tokenSymbol="link" />)
		renderToStaticMarkup(<TokenUsageSection tokenSymbol="link" initialPageSize={30} />)
		const defaultTableCall = paginatedTableCalls[0]
		const expandedTableCall = paginatedTableCalls[1]

		expect(defaultTableCall?.renderedNames).toEqual(Array.from({ length: 10 }, (_, index) => `Protocol ${22 - index}`))
		expect(defaultTableCall?.pageSizeOptions).toEqual([10, 20, 30, 50])
		expect(defaultTableCall?.pageSize).toBe(10)
		expect(expandedTableCall?.pageSize).toBe(30)
		expect(expandedTableCall?.renderedNames).toEqual(Array.from({ length: 22 }, (_, index) => `Protocol ${22 - index}`))
	})
})

describe('TokenUsageSection helpers', () => {
	test('builds table rows by summing usage amounts', () => {
		expect(
			buildTokenUsageRows([
				{
					name: 'Aave',
					category: 'Lending',
					amountUsd: { ethereum: 100, base: 25 },
					logo: 'https://example.com/aave.png',
					slug: 'aave'
				}
			])
		).toEqual([
			{
				name: 'Aave',
				category: 'Lending',
				amountUsd: 125,
				logo: 'https://example.com/aave.png',
				slug: 'aave',
				misrepresentedTokens: undefined
			}
		])
	})

	test('drops misrepresented rows and optional CEX rows from the table data', () => {
		expect(
			filterTokenUsageRows(
				[
					{ name: 'Aave', category: 'Lending', amountUsd: 1 },
					{ name: 'Binance', category: 'CEX', amountUsd: 2 },
					{ name: 'Bad Row', category: 'DEX', amountUsd: 3, misrepresentedTokens: true }
				],
				false
			)
		).toEqual([{ name: 'Aave', category: 'Lending', amountUsd: 1 }])
	})
})
