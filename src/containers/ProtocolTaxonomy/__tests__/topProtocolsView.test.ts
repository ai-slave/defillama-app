import { expect, test } from 'vitest'
import { getQueryUpdatesFromSelected } from '~/components/Select/query'
import { selectTopProtocolsView } from '../topProtocolsView'

const CHAINS = ['Ethereum', 'Solana', 'Base']
const CATEGORIES = ['Lending', 'Dexs']
const ROWS = CHAINS.map((chain) => ({ chain, Lending: `${chain} lender`, Dexs: `${chain} dex` }))

const view = (query: Record<string, string | Array<string> | undefined>) =>
	selectTopProtocolsView(ROWS, CHAINS, CATEGORIES, query)
const chainNames = (query: Record<string, string | Array<string> | undefined>) =>
	view(query).rows.map((row) => row.chain)

test('shows the chains the chain picker selects', () => {
	expect(chainNames({})).toEqual(['Ethereum', 'Solana', 'Base'])
	expect(chainNames(getQueryUpdatesFromSelected('chain', 'excludeChain', CHAINS, ['Ethereum', 'Base']))).toEqual([
		'Ethereum',
		'Base'
	])
})

test('shows the category columns the column picker selects', () => {
	expect(view({}).columnVisibility).toEqual({ Lending: true, Dexs: true })
	expect(
		view(getQueryUpdatesFromSelected('column', 'excludeColumn', CATEGORIES, ['Lending'])).columnVisibility
	).toEqual({
		Lending: true,
		Dexs: false
	})
	expect(view(getQueryUpdatesFromSelected('column', 'excludeColumn', CATEGORIES, 'None')).columnVisibility).toEqual({
		Lending: false,
		Dexs: false
	})
})
