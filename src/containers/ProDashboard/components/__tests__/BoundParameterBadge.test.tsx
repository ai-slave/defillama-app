// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { accessibleName } from '~/utils/testing/accessibleName'
import { DashboardTestProvider } from '~/utils/testing/dashboardContext'
import { tabTo } from '~/utils/testing/keyboard'
import { waitForUi } from '~/utils/testing/waitForUi'
import type { DashboardVariable } from '../../dashboardTypes'
import { BoundParameterBadge } from '../BoundParameterBadge'

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

// Each badge is a tab stop, so it can open its tooltip from the keyboard.
const badgesIn = () => [...container.querySelectorAll<HTMLElement>('[tabindex="0"]')]

/** Tabs to the badge and returns the tooltip text it opens. */
const explanationOf = async (badge: HTMLElement) => {
	await tabTo(badge)
	let text = ''
	await waitForUi(() => {
		text = document.querySelector('[role="tooltip"]')?.textContent ?? ''
		expect(text).not.toBe('')
	})
	return text
}

test('renders one badge per bound variable, each explaining itself to a keyboard reader', async () => {
	const unmount = await render(<BoundParameterBadge bindings={{ chain: 'chain', protocol: 'protocol' }} />)
	const badges = badgesIn()
	expect(badges.map(accessibleName)).toEqual([
		'Chain, bound to dashboard parameter',
		'Protocol, bound to dashboard parameter'
	])
	expect(await explanationOf(badges[0]!)).toBe('Bound to dashboard parameter')
	await unmount()
})

test('renders a single badge when two fields point at the same variable', async () => {
	const unmount = await render(<BoundParameterBadge bindings={{ chain: 'chain', chains: 'chain' }} />)
	expect(badgesIn()).toHaveLength(1)
	await unmount()
})

test('renders the badge without actions in read-only mode', async () => {
	const unmount = await render(<BoundParameterBadge bindings={{ chain: 'chain' }} />, { isReadOnly: true })
	const [badge] = badgesIn()
	expect(accessibleName(badge!)).toBe('Chain, follows the Chain parameter')
	expect(container.querySelector('button')).toBeNull()
	expect(await explanationOf(badge)).toBe('Follows the Chain parameter')
	await unmount()
})

test('skips a binding whose variable was deleted and keeps the live one', async () => {
	const unmount = await render(<BoundParameterBadge bindings={{ chain: 'chain', protocol: 'protocol' }} />, {
		variables: [protocolVariable]
	})
	expect(badgesIn().map(accessibleName)).toEqual(['Protocol, bound to dashboard parameter'])
	await unmount()
})
