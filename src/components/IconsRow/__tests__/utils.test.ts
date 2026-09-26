import { expect, test } from 'vitest'
import { readSelectionFromQuery } from '~/components/Select/query'
import { yieldsChainHref, yieldsProtocolsHref } from '../utils'

// The Yields pickers read these links back, so a link must select exactly the names it was built from.
function yieldsQuery(href: string) {
	const params = new URL(href, 'https://defillama.com').searchParams
	return { chain: params.getAll('chain'), protocol: params.getAll('protocol') }
}

test('links to Yields filtered to the named protocols', () => {
	const href = yieldsProtocolsHref(['Aave V3', 'Lido'])
	expect(href).toBe('/yields?protocol=Aave+V3&protocol=Lido')
	expect(
		readSelectionFromQuery(yieldsQuery(href), 'protocol', 'excludeProtocol', ['Aave V3', 'Lido', 'Morpho'])
	).toEqual(['Aave V3', 'Lido'])
})

test('links to Yields filtered to a chain whose name needs encoding', () => {
	const href = yieldsChainHref('OP Mainnet')
	expect(readSelectionFromQuery(yieldsQuery(href), 'chain', 'excludeChain', ['Ethereum', 'OP Mainnet'])).toEqual([
		'OP Mainnet'
	])
})
