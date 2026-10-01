import { expect, test } from 'vitest'
import { findPortfolioNameError } from '../NewPortfolioDialog'

const portfolios = ['main', 'Stables']

test('a blank or spaces-only name is refused', () => {
	expect(findPortfolioNameError('', portfolios)).toBe('Enter a name.')
	expect(findPortfolioNameError('   ', portfolios)).toBe('Enter a name.')
})

test('an existing name is refused whatever its case or surrounding spaces', () => {
	expect(findPortfolioNameError('Main', portfolios)).toBe('A portfolio with this name exists.')
	expect(findPortfolioNameError(' stables ', portfolios)).toBe('A portfolio with this name exists.')
})

test('a new name is accepted', () => {
	expect(findPortfolioNameError('L2s', portfolios)).toBeNull()
})
