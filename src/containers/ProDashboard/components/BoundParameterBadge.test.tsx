// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { DashboardTestProvider } from '~/utils/test/dashboardContext'
import type { DashboardVariable } from '../dashboardTypes'
import { BoundParameterBadge } from './BoundParameterBadge'

const chainVariable: DashboardVariable = {
	id: 'chain',
	kind: 'chain',
	label: 'Chain',
	value: 'Ethereum'
}
const protocolVariable: DashboardVariable = {
	id: 'protocol',
	kind: 'protocol',
	label: 'Protocol',
	value: 'aave'
}

let container: HTMLDivElement

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	container = document.createElement('div')
	document.body.append(container)
})

afterEach(() => {
	container.remove()
})

const render = async (
	element: React.ReactElement,
	{ variables = [chainVariable, protocolVariable], isReadOnly = false } = {}
) => {
	const root = createRoot(container)
	await act(async () =>
		root.render(
			<DashboardTestProvider variables={{ variables }} permissions={{ isReadOnly }}>
				{element}
			</DashboardTestProvider>
		)
	)
	return () => act(() => root.unmount())
}

test('renders one badge per bound variable with its label as plain text', async () => {
	const unmount = await render(<BoundParameterBadge bindings={{ chain: 'chain', protocol: 'protocol' }} />)
	const badges = [...container.querySelectorAll('span')]
	expect(badges.map((badge) => badge.textContent)).toEqual(['Chain', 'Protocol'])
	expect(badges[0]?.getAttribute('title')).toBe('Bound to dashboard parameter')
	await unmount()
})

test('renders a single badge when two fields point at the same variable', async () => {
	const unmount = await render(<BoundParameterBadge bindings={{ chain: 'chain', chains: 'chain' }} />)
	expect(container.querySelectorAll('span')).toHaveLength(1)
	await unmount()
})

test('renders the badge without actions in read-only mode', async () => {
	const unmount = await render(<BoundParameterBadge bindings={{ chain: 'chain' }} />, { isReadOnly: true })
	const badge = container.querySelector('span')!
	expect(badge.textContent).toBe('Chain')
	expect(badge.getAttribute('title')).toBe('Follows the Chain parameter')
	expect(container.querySelector('button')).toBeNull()
	await unmount()
})

test('skips a binding whose variable was deleted and keeps the live one', async () => {
	const unmount = await render(<BoundParameterBadge bindings={{ chain: 'chain', protocol: 'protocol' }} />, {
		variables: [protocolVariable]
	})
	expect([...container.querySelectorAll('span')].map((badge) => badge.textContent)).toEqual(['Protocol'])
	await unmount()
})
