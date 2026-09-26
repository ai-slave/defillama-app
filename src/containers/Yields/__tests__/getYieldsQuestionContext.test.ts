import { expect, test } from 'vitest'
import { getYieldsQuestionContext } from '../getYieldsQuestionContext'

const OPTIONS = {
	chainList: ['Ethereum', 'Base', 'Solana'],
	projectList: ['Aave', 'Lido'],
	categoryList: ['Lending', 'Dexs']
}

test('asks about the pools the pickers actually select', () => {
	expect(
		getYieldsQuestionContext({ excludeChain: 'Solana', protocol: 'Lido', category: 'None', minTvl: '1000' }, OPTIONS)
	).toEqual({ filters: { chains: ['Ethereum', 'Base'], projects: ['Lido'], categories: [], minTvl: 1000 } })
})

test('leaves out pickers that select every option', () => {
	expect(getYieldsQuestionContext({ chain: 'All' }, OPTIONS)).toBeNull()
})
