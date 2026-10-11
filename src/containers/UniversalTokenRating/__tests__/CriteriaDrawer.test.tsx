// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { accessibleName } from '~/utils/testing/accessibleName'
import { applyBreakpointClasses } from '~/utils/testing/breakpoints'
import { waitForUi } from '~/utils/testing/waitForUi'
import { CriteriaDrawer, type CriteriaDrawerState } from '../CriteriaDrawer'
import type { UtrCriterionBreakdown } from '../types'

const criterion = (key: string, label: string): UtrCriterionBreakdown => ({
	key,
	label,
	weight: 0.5,
	score: 7,
	grade: 'A',
	percentile: 80,
	note: null
})

const drawer = (activeKey: string | null): CriteriaDrawerState => ({
	title: 'Disclosure criteria',
	axis: 'disclosure',
	criteria: [criterion('team', 'Team'), criterion('treasury', 'Treasury')],
	docs: [],
	activeKey
})

let root: Root
let container: HTMLDivElement
beforeEach(() => {
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	window.happyDOM.setViewport({ width: 1024, height: 768 })
})

const detailHeading = () => document.querySelector<HTMLElement>('[role="dialog"] section h3')
const listRow = (name: string) =>
	[...document.querySelectorAll<HTMLElement>('nav[aria-label="Criteria"] button')].find((row) =>
		accessibleName(row).endsWith(name)
	)!

test.each([
	[375, 'the detail heading, as the list hides'],
	[1024, 'the row, beside the detail']
] as const)('picking a criterion at %ipx leaves focus on %s', async (width, _target) => {
	window.happyDOM.setViewport({ width, height: 800 })
	await applyBreakpointClasses(['max-md:hidden', 'md:hidden'])
	await act(async () => root.render(<CriteriaDrawer state={drawer(null)} onClose={() => {}} />))
	await waitForUi(() => expect(document.querySelector('[role="dialog"]')).not.toBeNull())
	const treasury = listRow('Treasury')
	await act(async () => {
		treasury.focus()
		treasury.click()
	})
	expect(detailHeading()?.textContent).toContain('Treasury')
	expect(document.activeElement).toBe(width < 768 ? detailHeading() : treasury)
})

test('opened on a criterion, the sheet starts on its detail heading', async () => {
	await act(async () => root.render(<CriteriaDrawer state={drawer('treasury')} onClose={() => {}} />))
	await waitForUi(() => expect(document.activeElement).toBe(detailHeading()))
	expect(detailHeading()?.textContent).toContain('Treasury')
})
