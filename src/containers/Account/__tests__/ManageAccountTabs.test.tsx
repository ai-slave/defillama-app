// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { accessibleName } from '~/utils/testing/accessibleName'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { ManageAccount } from '../ManageAccount'

const router = vi.hoisted(() => ({
	isReady: true,
	pathname: '/account',
	query: {} as Record<string, string>,
	replace: vi.fn()
}))
vi.mock('next/router', () => ({ useRouter: () => router }))
// Each panel's cards load their own data; these tests assert only which panel shows.
vi.mock('../AuthenticationCard', () => ({ AuthenticationCard: () => null }))
vi.mock('../ReferralCard', () => ({ ReferralCard: () => null }))
vi.mock('../SettingsCard', () => ({ SettingsCard: () => null }))
vi.mock('~/components/Newsletter/NewsletterSignup', () => ({ NewsletterSignup: () => null }))
vi.mock('../SubscriptionSection', () => ({ SubscriptionSection: () => null }))
vi.mock('../DeleteAccountCard', () => ({ DeleteAccountCard: () => null }))
vi.mock('../Team/TeamTab', () => ({ TeamTab: () => null }))
vi.mock('~/containers/Authors/DashboardAuthorProfileCard', () => ({ DashboardAuthorProfileCard: () => null }))
vi.mock('../UserHeader', () => ({ UserHeader: () => null }))

const session = installSubscriberSession('u1', { resolved: true })
let root: Root
let container: HTMLDivElement
beforeEach(() => {
	router.query = { tab: 'team', ref: 'nav' }
	router.replace.mockClear()
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

async function render() {
	await act(async () =>
		root.render(
			<session.Wrapper>
				<ManageAccount />
			</session.Wrapper>
		)
	)
}
const tab = (name: string) =>
	[...document.querySelectorAll<HTMLElement>('[role="tab"]')].find((node) => accessibleName(node) === name)!
const visiblePanel = () => document.querySelector<HTMLElement>('[role="tabpanel"]:not([hidden])')!

test('the URL picks the account section, and choosing another writes it back', async () => {
	await render()
	expect(accessibleName(document.querySelector<HTMLElement>('[role="tablist"]')!)).toBe('Account sections')
	expect([...document.querySelectorAll('[role="tab"]')].map((node) => node.textContent)).toEqual([
		'Account',
		'Team',
		'Profile'
	])
	expect(tab('Team').getAttribute('aria-selected')).toBe('true')
	expect(visiblePanel().getAttribute('aria-labelledby')).toBe(tab('Team').id)

	await act(async () => tab('Profile').click())
	expect(router.replace).toHaveBeenLastCalledWith(
		{ pathname: '/account', query: { tab: 'profile', ref: 'nav' } },
		undefined,
		{ shallow: true }
	)
	await act(async () => tab('Account').click())
	expect(router.replace).toHaveBeenLastCalledWith({ pathname: '/account', query: { ref: 'nav' } }, undefined, {
		shallow: true
	})

	router.query = { tab: 'profile', ref: 'nav' }
	await render()
	expect(tab('Profile').getAttribute('aria-selected')).toBe('true')
	expect(visiblePanel().getAttribute('aria-labelledby')).toBe(tab('Profile').id)
})
