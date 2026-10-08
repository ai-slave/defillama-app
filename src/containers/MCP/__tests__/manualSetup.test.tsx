// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { accessibleName } from '~/utils/testing/accessibleName'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import MCPContainer from '..'

const session = installSubscriberSession('mcp-reader', { account: 'signed-out' })

let root: Root
let container: HTMLDivElement

beforeEach(async () => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
	await act(async () =>
		root.render(
			<session.Wrapper>
				<MCPContainer />
			</session.Wrapper>
		)
	)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

const tab = (name: string) =>
	[...container.querySelectorAll<HTMLElement>('[role="tablist"][aria-label="MCP client"] [role="tab"]')].find(
		(x) => x.textContent === name
	)!
const visibleCopyButton = () => container.querySelector<HTMLElement>('[role="tabpanel"]:not([hidden]) button')!

test('the manual setup opens on Claude Code, and picking Codex shows the Codex snippet to copy', async () => {
	expect(tab('Claude Code').getAttribute('aria-selected')).toBe('true')
	expect(accessibleName(visibleCopyButton())).toBe('Copy Claude Code')

	await act(async () => tab('Codex').click())
	expect(tab('Codex').getAttribute('aria-selected')).toBe('true')
	expect(accessibleName(visibleCopyButton())).toBe('Copy Codex')
})
