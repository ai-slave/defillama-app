// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { DashboardVariable } from '../dashboardTypes'
import { BoundParameterBadge } from './BoundParameterBadge'

const mocks = vi.hoisted(() => ({
	variables: [] as Array<DashboardVariable>,
	permissions: { isReadOnly: false }
}))

vi.mock('../ProDashboardAPIContext', () => ({
	useProDashboardVariables: () => ({ variables: mocks.variables }),
	useProDashboardPermissions: () => mocks.permissions
}))

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
	mocks.variables = [chainVariable, protocolVariable]
	mocks.permissions = { isReadOnly: false }
	container = document.createElement('div')
	document.body.append(container)
})

afterEach(() => {
	container.remove()
})

const render = async (element: React.ReactElement) => {
	const root = createRoot(container)
	await act(async () => root.render(element))
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
	mocks.permissions = { isReadOnly: true }
	const unmount = await render(<BoundParameterBadge bindings={{ chain: 'chain' }} />)
	const badge = container.querySelector('span')!
	expect(badge.textContent).toBe('Chain')
	expect(badge.getAttribute('title')).toBe('Follows the Chain parameter')
	expect(container.querySelector('button')).toBeNull()
	await unmount()
})

test('renders nothing without bindings or when the bound variable is gone', async () => {
	const unmountEmpty = await render(<BoundParameterBadge />)
	expect(container.textContent).toBe('')
	await unmountEmpty()

	mocks.variables = [protocolVariable]
	const unmountStale = await render(<BoundParameterBadge bindings={{ chain: 'chain' }} />)
	expect(container.textContent).toBe('')
	await unmountStale()
})
