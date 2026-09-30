import { describe, expect, test } from 'vitest'
import { getQueryUpdatesFromSelected } from '~/components/Select/query'
import { CUSTODY_OPTIONS, filterCards, resolveCardsFilterState } from '../filterPolicy'
import { groupCardRows, mapCardsIndex } from '../models'
import { cardsIndexCard, cardsIndexResponse } from './fixtures'

describe('crypto card ordering', () => {
	test('ranks cards by issuer all-time spend, with ties stable and unknown spend after measured zero', () => {
		const cards = [
			cardsIndexCard('untracked'),
			{ ...cardsIndexCard('small'), defillama_id: '1' },
			{ ...cardsIndexCard('zero'), defillama_id: '2' },
			{ ...cardsIndexCard('large'), defillama_id: '3' },
			{ ...cardsIndexCard('tied'), defillama_id: '4' },
			{ ...cardsIndexCard('unavailable'), defillama_id: '5' }
		]
		const { rows } = mapCardsIndex(cardsIndexResponse(cards), {}, [
			{ defillamaId: '1', totalAllTime: 100, total7d: 90, total24h: 80, total30d: 99 },
			{ defillamaId: '2', totalAllTime: 0 },
			{ defillamaId: '3', totalAllTime: 500, total7d: 10 },
			{ defillamaId: '4', totalAllTime: 100 },
			{ defillamaId: '5', totalAllTime: null, total7d: 999 }
		])
		expect(rows.map((row) => row.cardId)).toEqual(['large', 'small', 'tied', 'zero', 'untracked', 'unavailable'])
	})

	test('ranks an issuer by its child protocols without counting repeated cards or tiers twice', () => {
		const first = { ...cardsIndexCard('first', 'issuer'), defillama_id: '1', defillama_parent_id: 'parent#issuer' }
		first.tiers.push({ ...first.tiers[0]!, id: 'premium', name: 'Premium' })
		const second = { ...cardsIndexCard('second', 'issuer'), defillama_id: '1', defillama_parent_id: 'parent#issuer' }
		const cards = [
			first,
			{ ...cardsIndexCard('leader'), defillama_id: '3' },
			second,
			{ ...cardsIndexCard('middle'), defillama_id: '4' }
		]
		const { rows } = mapCardsIndex(cardsIndexResponse(cards), {}, [
			{ defillamaId: '1', parentProtocol: 'parent#issuer', totalAllTime: 60 },
			{ defillamaId: '2', parentProtocol: 'parent#issuer', totalAllTime: 50 },
			{ defillamaId: '3', totalAllTime: 150 },
			{ defillamaId: '4', totalAllTime: 100 }
		])
		const grouped = groupCardRows(rows)
		expect(grouped.map((row) => row.cardId)).toEqual(['leader', 'issuer', 'middle'])
		expect(grouped[1]?.subRows?.map((row) => row.cardId)).toEqual(['first', 'second'])
		expect(grouped[1]?.subRows?.[0]?.subRows?.map((row) => row.tierName)).toEqual(['Standard', 'Premium'])
	})

	test('uses catalog parent mappings when adapter child volumes omit their parent', () => {
		const cards = [
			{ ...cardsIndexCard('first', 'issuer'), defillama_id: '1', defillama_parent_id: 'parent#issuer' },
			{ ...cardsIndexCard('competitor'), defillama_id: '3' },
			{ ...cardsIndexCard('second', 'issuer'), defillama_id: '2', defillama_parent_id: 'parent#issuer' }
		]
		const { rows } = mapCardsIndex(cardsIndexResponse(cards), {}, [
			{ defillamaId: '1', totalAllTime: 60 },
			{ defillamaId: '2', totalAllTime: 50, parentProtocol: 'parent#issuer' },
			{ defillamaId: '3', totalAllTime: 100 }
		])
		expect(groupCardRows(rows).map((row) => row.cardId)).toEqual(['issuer', 'competitor'])
	})

	test('keeps issuer rank when a filter removes the only sibling carrying a protocol mapping', () => {
		const unmapped = cardsIndexCard('unmapped', 'issuer')
		const competitor = { ...cardsIndexCard('competitor'), defillama_id: '2' }
		const mapped = { ...cardsIndexCard('mapped', 'issuer'), defillama_id: '1' }
		unmapped.tiers[0]!.crypto.custody = 'self-custodial'
		competitor.tiers[0]!.crypto.custody = 'self-custodial'
		mapped.tiers[0]!.crypto.custody = 'custodial'
		const { rows } = mapCardsIndex(cardsIndexResponse([unmapped, competitor, mapped]), {}, [
			{ defillamaId: '1', totalAllTime: 500 },
			{ defillamaId: '2', totalAllTime: 100 }
		])
		const query = getQueryUpdatesFromSelected(
			'custody',
			'excludeCustody',
			CUSTODY_OPTIONS.map((option) => option.key),
			['self-custodial']
		)
		const filtered = filterCards(rows, resolveCardsFilterState(query, []))
		expect(groupCardRows(filtered).map((row) => [row.cardId, row.subRows?.map((card) => card.cardId)])).toEqual([
			['issuer', ['unmapped']],
			['competitor', undefined]
		])
	})

	test('preserves catalog order when spend data is unavailable', () => {
		const { rows } = mapCardsIndex(cardsIndexResponse([cardsIndexCard('z'), cardsIndexCard('a')]), {}, [])
		expect(rows.map((row) => row.cardId)).toEqual(['z', 'a'])
	})
})
