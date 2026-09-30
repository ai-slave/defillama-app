// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, test, vi } from 'vitest'
import { useTerminalChatCollapsed, useTerminalChatRatio } from '../terminalViewStore'

vi.mock('next/router', () => ({ default: { push: vi.fn(), replace: vi.fn() } }))

function Split() {
	const ratio = useTerminalChatRatio()
	const collapsed = useTerminalChatCollapsed()
	return <output>{`${ratio} ${collapsed ? 'collapsed' : 'open'}`}</output>
}

test('the terminal split opens at the layout the reader last left it in', async () => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	localStorage.setItem('llamaai-terminal-view', JSON.stringify({ chatRatio: 0.4, chatCollapsed: true }))
	const host = document.createElement('div')
	const root = createRoot(host)

	await act(async () => root.render(<Split />))

	expect(host.textContent).toBe('0.4 collapsed')
	await act(async () => root.unmount())
})
