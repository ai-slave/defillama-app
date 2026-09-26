import { describe, expect, test } from 'vitest'
import { getQueryUpdatesFromSelected } from '~/components/Select/query'
import { cardsChainOptions, filterCards, isCardAvailableIn, resolveCardsFilterState } from '../filterPolicy'
import type { CardTierRow } from '../models'
import { cardTierRow as row } from './fixtures'

const listsGermanyA = row('lists-de-a', { availabilityUnknown: false, countryCodes: ['DE', 'FR'] })
const listsGermanyB = row('lists-de-b', { availabilityUnknown: false, countryCodes: ['DE'] })
const unknownA = row('unknown-a')
const unknownB = row('unknown-b')
const listsOnlyFrance = row('lists-fr', { availabilityUnknown: false, countryCodes: ['FR'] })

const rows = [listsGermanyA, listsGermanyB, unknownA, unknownB, listsOnlyFrance]

// The page reads chains against the chain keys of the cards it lists.
const filterBy = (cards: Array<CardTierRow>, query: Record<string, string | Array<string> | undefined>) =>
	filterCards(
		cards,
		resolveCardsFilterState(
			query,
			cardsChainOptions(cards).map((option) => option.key)
		)
	).map((card) => card.cardId)

describe('isCardAvailableIn', () => {
	test('treats confirmed lists as allowlist claims and undisclosed availability as unknown', () => {
		expect(isCardAvailableIn(listsGermanyA, 'DE')).toBe(true)
		expect(isCardAvailableIn(listsOnlyFrance, 'DE')).toBe(false)
		expect(isCardAvailableIn(unknownA, 'DE')).toBe(null)
	})
})

describe('filterCards', () => {
	test('shows only explicit allowlist matches by default', () => {
		expect(filterBy(rows, { country: 'de' })).toEqual(['lists-de-a', 'lists-de-b'])
	})

	test('adds undisclosed-availability rows when includeUnknown is set', () => {
		expect(filterBy(rows, { country: 'de', includeUnknown: 'true' })).toEqual([
			'lists-de-a',
			'lists-de-b',
			'unknown-a',
			'unknown-b'
		])
	})

	test('returns all rows when no country is selected', () => {
		expect(filterBy(rows, {})).toEqual(['lists-de-a', 'lists-de-b', 'unknown-a', 'unknown-b', 'lists-fr'])
	})

	test('ignores malformed country params', () => {
		expect(resolveCardsFilterState({ country: 'germany' }, []).country).toBe(null)
		expect(resolveCardsFilterState({ country: ['de', 'fr'] }, []).country).toBe('DE')
	})
})

describe('custody and card-form filters', () => {
	const selfCustodial = row('self', { custodyType: 'self-custodial', physical: true, virtual: false })
	const custodial = row('custodial', { custodyType: 'custodial', physical: false, virtual: true })
	const unknownCustody = row('no-custody', { custodyType: null, physical: null, virtual: true })
	const formRows = [selfCustodial, custodial, unknownCustody]

	test('treats absent custody param as all selected, including unknown-custody rows', () => {
		expect(resolveCardsFilterState({}, []).hasActiveFilters).toBe(false)
		expect(filterBy(formRows, {})).toEqual(['self', 'custodial', 'no-custody'])
	})

	test('drops unknown-custody rows when custody is narrowed', () => {
		expect(filterBy(formRows, { custody: 'self-custodial' })).toEqual(['self'])
	})

	test('treats a full custody selection as inactive, and None as nothing selected', () => {
		// Both options selected = the facet is inactive, so unknown-custody rows stay.
		expect(filterBy(formRows, { custody: ['self-custodial', 'custodial'] })).toEqual([
			'self',
			'custodial',
			'no-custody'
		])
		expect(filterBy(formRows, { custody: 'custodial' })).toEqual(['custodial'])
		expect(filterBy(formRows, { custody: 'None' })).toEqual([])
	})

	test('physical/virtual checkboxes require an explicit true claim', () => {
		expect(filterBy(formRows, { physical: 'true' })).toEqual(['self'])
		expect(filterBy(formRows, { virtual: 'true' })).toEqual(['custodial', 'no-custody'])
	})

	test('composes with the availability filter', () => {
		const germanCustodial = row('de-custodial', {
			availabilityUnknown: false,
			countryCodes: ['DE'],
			custodyType: 'custodial'
		})
		const germanSelf = row('de-self', {
			availabilityUnknown: false,
			countryCodes: ['DE'],
			custodyType: 'self-custodial'
		})
		const frenchCustodial = row('fr-custodial', {
			availabilityUnknown: false,
			countryCodes: ['FR'],
			custodyType: 'custodial'
		})
		expect(filterBy([germanCustodial, germanSelf, frenchCustodial], { country: 'de', custody: 'custodial' })).toEqual([
			'de-custodial'
		])
	})
})

describe('type, network, and chain filters', () => {
	const debitVisa = row('debit-visa', {
		cardClassification: 'debit',
		network: 'visa',
		supportedChains: ['Gnosis Chain']
	})
	const creditMc = row('credit-mc', {
		cardClassification: 'credit',
		network: 'mastercard',
		supportedChains: ['Ethereum', 'Base']
	})
	const spendUnknownNetwork = row('spend-unknown', {
		cardClassification: 'spend',
		network: null,
		supportedChains: []
	})
	const typedRows = [debitVisa, creditMc, spendUnknownNetwork]

	test('matches the classification against the option keys', () => {
		expect(filterBy(typedRows, { type: 'credit' })).toEqual(['credit-mc'])
		expect(filterBy(typedRows, { type: ['debit', 'spend'] })).toEqual(['debit-visa', 'spend-unknown'])
	})

	test('filters by network and drops unknown-network rows when narrowed', () => {
		expect(filterBy(typedRows, { network: 'mastercard' })).toEqual(['credit-mc'])
	})

	test('filters by chain key, and None or only unknown chains match nothing', () => {
		expect(filterBy(typedRows, { chain: 'base' })).toEqual(['credit-mc'])
		expect(filterBy(typedRows, { chain: ['gnosis chain', 'base'] })).toEqual(['debit-visa', 'credit-mc'])
		expect(filterBy(typedRows, { chain: ['base', 'solana'] })).toEqual(['credit-mc'])
		expect(filterBy(typedRows, { chain: 'solana' })).toEqual([])
		expect(filterBy(typedRows, { chain: 'None' })).toEqual([])
	})

	test('reads what the picker writes, exclude lists included', () => {
		const chainKeys = cardsChainOptions(typedRows).map((option) => option.key)
		expect(
			filterBy(
				typedRows,
				getQueryUpdatesFromSelected(
					'type',
					'excludeType',
					['debit', 'credit', 'prepaid', 'spend'],
					['debit', 'credit', 'prepaid']
				)
			)
		).toEqual(['debit-visa', 'credit-mc'])
		expect(
			filterBy(
				typedRows,
				getQueryUpdatesFromSelected(
					'chain',
					'excludeChain',
					chainKeys,
					chainKeys.filter((key) => key !== 'gnosis chain')
				)
			)
		).toEqual(['credit-mc'])
	})

	test('selects nothing when a facet names only unknown values', () => {
		expect(filterBy(typedRows, { type: 'charge' })).toEqual([])
	})
})
