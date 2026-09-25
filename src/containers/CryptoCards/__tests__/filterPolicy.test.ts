import { describe, expect, test } from 'vitest'
import { filterCards, isCardAvailableIn, resolveCardsFilterState } from '../filterPolicy'
import { cardTierRow as row } from './fixtures'

const listsGermanyA = row('lists-de-a', { availabilityUnknown: false, countryCodes: ['DE', 'FR'] })
const listsGermanyB = row('lists-de-b', { availabilityUnknown: false, countryCodes: ['DE'] })
const unknownA = row('unknown-a')
const unknownB = row('unknown-b')
const listsOnlyFrance = row('lists-fr', { availabilityUnknown: false, countryCodes: ['FR'] })

const rows = [listsGermanyA, listsGermanyB, unknownA, unknownB, listsOnlyFrance]

describe('isCardAvailableIn', () => {
	test('treats confirmed lists as allowlist claims and undisclosed availability as unknown', () => {
		expect(isCardAvailableIn(listsGermanyA, 'DE')).toBe(true)
		expect(isCardAvailableIn(listsOnlyFrance, 'DE')).toBe(false)
		expect(isCardAvailableIn(unknownA, 'DE')).toBe(null)
	})
})

describe('filterCards', () => {
	test('shows only explicit allowlist matches by default', () => {
		const state = resolveCardsFilterState({ country: 'de' })
		expect(filterCards(rows, state).map((r) => r.cardId)).toEqual(['lists-de-a', 'lists-de-b'])
	})

	test('adds undisclosed-availability rows when includeUnknown is set', () => {
		const state = resolveCardsFilterState({ country: 'de', includeUnknown: 'true' })
		expect(filterCards(rows, state).map((r) => r.cardId)).toEqual([
			'lists-de-a',
			'lists-de-b',
			'unknown-a',
			'unknown-b'
		])
	})

	test('returns all rows when no country is selected', () => {
		expect(filterCards(rows, resolveCardsFilterState({})).map((item) => item.cardId)).toEqual([
			'lists-de-a',
			'lists-de-b',
			'unknown-a',
			'unknown-b',
			'lists-fr'
		])
	})

	test('ignores malformed country params', () => {
		expect(resolveCardsFilterState({ country: 'germany' }).country).toBe(null)
		expect(resolveCardsFilterState({ country: ['de', 'fr'] }).country).toBe('DE')
	})
})

describe('custody and card-form filters', () => {
	const selfCustodial = row('self', { custodyType: 'self-custodial', physical: true, virtual: false })
	const custodial = row('custodial', { custodyType: 'custodial', physical: false, virtual: true })
	const unknownCustody = row('no-custody', { custodyType: null, physical: null, virtual: true })
	const formRows = [selfCustodial, custodial, unknownCustody]

	test('treats absent custody param as all selected, including unknown-custody rows', () => {
		const state = resolveCardsFilterState({})
		expect(state.hasActiveFilters).toBe(false)
		expect(filterCards(formRows, state).map((item) => item.cardId)).toEqual(['self', 'custodial', 'no-custody'])
	})

	test('drops unknown-custody rows when custody is narrowed', () => {
		const state = resolveCardsFilterState({ custody: 'self-custodial' })
		expect(filterCards(formRows, state).map((r) => r.cardId)).toEqual(['self'])
	})

	test('treats a full custody selection as inactive and supports the none sentinel', () => {
		// Both options selected = the facet is inactive, so unknown-custody rows stay.
		expect(
			filterCards(formRows, resolveCardsFilterState({ custody: ['self-custodial', 'custodial'] })).map(
				(item) => item.cardId
			)
		).toEqual(['self', 'custodial', 'no-custody'])
		expect(filterCards(formRows, resolveCardsFilterState({ custody: 'custodial' })).map((r) => r.cardId)).toEqual([
			'custodial'
		])
		expect(filterCards(formRows, resolveCardsFilterState({ custody: 'none' }))).toHaveLength(0)
	})

	test('physical/virtual checkboxes require an explicit true claim', () => {
		expect(filterCards(formRows, resolveCardsFilterState({ physical: 'true' })).map((r) => r.cardId)).toEqual(['self'])
		expect(filterCards(formRows, resolveCardsFilterState({ virtual: 'true' })).map((r) => r.cardId)).toEqual([
			'custodial',
			'no-custody'
		])
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
		const state = resolveCardsFilterState({ country: 'de', custody: 'custodial' })
		expect(filterCards([germanCustodial, germanSelf, frenchCustodial], state).map((r) => r.cardId)).toEqual([
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
		expect(filterCards(typedRows, resolveCardsFilterState({ type: 'credit' })).map((r) => r.cardId)).toEqual([
			'credit-mc'
		])
		expect(
			filterCards(typedRows, resolveCardsFilterState({ type: ['debit', 'spend'] })).map((item) => item.cardId)
		).toEqual(['debit-visa', 'spend-unknown'])
	})

	test('filters by network and drops unknown-network rows when narrowed', () => {
		expect(filterCards(typedRows, resolveCardsFilterState({ network: 'mastercard' })).map((r) => r.cardId)).toEqual([
			'credit-mc'
		])
	})

	test('filters by chain, case-insensitively, and none matches nothing', () => {
		expect(filterCards(typedRows, resolveCardsFilterState({ chain: 'base' })).map((r) => r.cardId)).toEqual([
			'credit-mc'
		])
		expect(
			filterCards(typedRows, resolveCardsFilterState({ chain: ['gnosis chain', 'base'] })).map((item) => item.cardId)
		).toEqual(['debit-visa', 'credit-mc'])
		expect(filterCards(typedRows, resolveCardsFilterState({ chain: 'none' }))).toHaveLength(0)
	})
})
