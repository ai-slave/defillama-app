// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { installUmamiSink } from '~/utils/testing/umamiSink'
import { waitForUi } from '~/utils/testing/waitForUi'
import type { TokenRightsLink, TokenRightsUtrSummary } from '../badge'
import { TokenRightsPieHovercard } from '../TokenRightsPopover'
import type { TokenRightsPreview } from '../types'
import { UtrGradeHovercard } from '../UtrPopover'

const aaveRights: TokenRightsPreview = {
	protocolName: 'Aave',
	identityTokens: ['AAVE'],
	utilityItems: [],
	primaryValue: 'Buybacks',
	primaryDetails: null,
	governance: true,
	treasury: true,
	revenue: true,
	buybacks: true,
	dividends: false,
	burns: false,
	equityTone: 'positive'
}

const aaveUtr: TokenRightsUtrSummary = {
	grade: 'AA',
	disclosureGrade: 'A',
	performanceGrade: 'BBB',
	href: '/universal-token-rating/token/aave',
	projectName: 'Aave',
	symbol: 'AAVE',
	score: 72.4,
	disclosureScore: 8.1,
	performanceScore: 6.25,
	momChangePct: 3.2,
	rank: 12,
	preTge: false,
	gradedCount: 38,
	criteriaCount: 40,
	asOf: '2026-09-25'
}

const aaveRightsLink: TokenRightsLink = { preview: aaveRights, href: '/token/AAVE#token-rights-and-value-accrual' }

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
})

/** Finds a button by its accessible name: its aria-label, or its text (the pie's name is its SVG title). */
function button(name: string): HTMLButtonElement {
	const match = [...document.querySelectorAll('button')].find(
		(element) => element.getAttribute('aria-label') === name || element.textContent?.startsWith(name)
	)
	if (!match) throw new Error(`No button named ${name}`)
	return match
}

function linkHref(text: string): string | null {
	const link = [...document.querySelectorAll('a')].find((element) => element.textContent?.includes(text))
	return link ? link.getAttribute('href') : null
}

describe('TokenRightsPieHovercard', () => {
	test('opens the rights card from the pie, linking to the token page and the rating', async () => {
		await act(async () =>
			root.render(
				<TokenRightsPieHovercard
					name="Aave Protocol"
					rights={aaveRights}
					fullRightsHref={aaveRightsLink.href}
					utr={aaveUtr}
					placement="right-start"
				/>
			)
		)

		await act(async () => button('Token rights summary').click())

		await waitForUi(() => expect(linkHref('View full token rights')).toBe('/token/AAVE#token-rights-and-value-accrual'))
		expect(linkHref('UTR')).toBe('/universal-token-rating/token/aave')
		// Titled with the row's DefiLlama name, not the token rights source's name.
		expect(document.querySelector('h3')?.textContent).toBe('Aave Protocol$AAVEToken Rights')
	})
})

describe('UtrGradeHovercard', () => {
	test('opens the rating card with scores, standing and a link to the full rating', async () => {
		await act(async () => root.render(<UtrGradeHovercard name="Aave Protocol" utr={aaveUtr} rights={aaveRightsLink} />))

		await act(async () => button('Universal Token Rating AA').click())

		await waitForUi(() => expect(linkHref('View full rating')).toBe('/universal-token-rating/token/aave'))
		expect(document.body.textContent).toContain('72.40')
		expect(document.querySelector('h3')?.textContent).toBe('Aave Protocol$AAVEUniversal Token Rating')
		expect(document.body.textContent).toContain('#12 among listed tokens · 38 of 40 criteria graded')
		expect(document.body.textContent).toContain('As of Sep 25, 2026')
		expect(linkHref('Rights')).toBe('/token/AAVE#token-rights-and-value-accrual')
	})

	test('leaves out the rights link when there are no rights or no token page to open', async () => {
		await act(async () => root.render(<UtrGradeHovercard name="Aave" utr={aaveUtr} rights={null} />))
		await act(async () => button('Universal Token Rating AA').click())
		await waitForUi(() => expect(linkHref('View full rating')).toBe('/universal-token-rating/token/aave'))
		expect(linkHref('Rights')).toBeNull()

		await act(async () =>
			root.render(<UtrGradeHovercard name="Aave" utr={aaveUtr} rights={{ preview: aaveRights, href: null }} />)
		)
		await waitForUi(() => expect(linkHref('View full rating')).toBe('/universal-token-rating/token/aave'))
		expect(linkHref('Rights')).toBeNull()
	})
})

describe('badge impressions', () => {
	const track = installUmamiSink()

	function badges() {
		return (
			<>
				<TokenRightsPieHovercard name="Aave" rights={aaveRights} fullRightsHref={aaveRightsLink.href} utr={aaveUtr} />
				<UtrGradeHovercard name="Aave" utr={aaveUtr} rights={aaveRightsLink} />
			</>
		)
	}

	test('counts an impression when a card is tapped open, not when its badge renders', async () => {
		await act(async () => root.render(badges()))
		expect(track).not.toHaveBeenCalled()

		await act(async () => button('Token rights summary').click())
		await act(async () => button('Universal Token Rating AA').click())

		expect(track.mock.calls).toEqual([
			['token-rights-impression', { entity: 'Aave' }],
			['utr-impression', { entity: 'Aave', grade: 'AA' }]
		])
	})

	test('counts an impression when a card is hovered open', async () => {
		await act(async () => root.render(badges()))

		await act(async () => {
			button('Universal Token Rating AA').dispatchEvent(new MouseEvent('mousemove', { bubbles: true }))
		})

		await waitForUi(() => expect(track.mock.calls).toEqual([['utr-impression', { entity: 'Aave', grade: 'AA' }]]))
	})
})
