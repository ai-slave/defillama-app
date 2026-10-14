// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, expect, test, vi } from 'vitest'
import { ProtocolFaq } from '../ProtocolFaq'
import type { IProtocolFaqItem } from '../types'

vi.mock('next/router', () => ({ useRouter: () => ({ asPath: '/protocol/aave', query: {} }) }))

let root: Root
let container: HTMLDivElement

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

function item(id: string, question: string): IProtocolFaqItem {
	return { id, question, answer: [{ text: `${question} answer` }] }
}

async function render(items: Array<IProtocolFaqItem>) {
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
	await act(async () => root.render(<ProtocolFaq items={items} />))
}

function openQuestions(): Array<string> {
	return [...container.querySelectorAll('details')]
		.filter((details) => details.hasAttribute('open'))
		.map((details) => details.querySelector('summary')?.textContent?.trim() ?? '')
}

test('opens the definition and the dollar answers, and leaves chains and price collapsed', async () => {
	await render([
		item('what-is', 'What is Aave?'),
		item('tvl', "What is Aave's TVL?"),
		item('fees-revenue', 'How much has Aave generated in fees and revenue?'),
		item('perp-volume', 'How much perpetual futures volume does Hyperliquid process?'),
		item('comparison', "How does Aave's TVL compare to similar protocols?"),
		item('chains', 'What chains does Aave operate on?'),
		item('token-valuation', 'What is the AAVE token price and valuation?'),
		item('token-performance', 'How has AAVE performed recently?')
	])

	expect(openQuestions()).toEqual([
		'What is Aave?',
		"What is Aave's TVL?",
		'How much has Aave generated in fees and revenue?',
		'How much perpetual futures volume does Hyperliquid process?',
		"How does Aave's TVL compare to similar protocols?"
	])
})

test('keeps chains and price collapsed when they would otherwise be in the first five, and still opens volume', async () => {
	await render([
		item('what-is', 'What is Variational?'),
		item('perp-volume', 'How much perpetual futures volume does Variational process?'),
		item('chains', 'What chains does Variational operate on?'),
		item('token-valuation', 'What is the VAR token price and valuation?'),
		item('token-performance', 'How has VAR performed recently?')
	])

	expect(openQuestions()).toEqual([
		'What is Variational?',
		'How much perpetual futures volume does Variational process?'
	])
})
