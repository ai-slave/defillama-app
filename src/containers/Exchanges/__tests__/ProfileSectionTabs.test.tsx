import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import { ProfileSectionTabs } from '../ExchangeProfile'

describe('profile section tabs', () => {
	test('associates the selected tab with the visible panel', () => {
		const html = renderToStaticMarkup(
			<ProfileSectionTabs activeTab="information" hasInformation onTabChange={() => undefined} panelId="profile-panel">
				<p>Information content</p>
			</ProfileSectionTabs>
		)

		expect(html).toContain('role="tablist"')
		const selectedTab = html.match(/<button[^>]*id="exchange-profile-tab-information"[^>]*>/)?.[0]
		expect(selectedTab).toContain('role="tab"')
		expect(selectedTab).toContain('aria-selected="true"')
		expect(selectedTab).toContain('aria-controls="profile-panel"')
		const panel = html.match(/<div[^>]*id="profile-panel"[^>]*>/)?.[0]
		expect(panel).toContain('role="tabpanel"')
		expect(panel).toContain('aria-labelledby="exchange-profile-tab-information"')
	})

	test('renders the reserves tab between markets and information only when reserves exist', () => {
		const withReserves = renderToStaticMarkup(
			<ProfileSectionTabs
				activeTab="reserves"
				hasReserves
				hasInformation
				onTabChange={() => undefined}
				panelId="profile-panel"
			>
				<p>Reserves content</p>
			</ProfileSectionTabs>
		)

		const tabIds = [...withReserves.matchAll(/id="exchange-profile-tab-(\w+)"/g)].map((match) => match[1])
		expect(tabIds).toEqual(['markets', 'reserves', 'information'])
		const selectedTab = withReserves.match(/<button[^>]*id="exchange-profile-tab-reserves"[^>]*>/)?.[0]
		expect(selectedTab).toContain('aria-selected="true"')

		const withoutReserves = renderToStaticMarkup(
			<ProfileSectionTabs activeTab="markets" hasInformation onTabChange={() => undefined} panelId="profile-panel">
				<p>Markets content</p>
			</ProfileSectionTabs>
		)
		expect(withoutReserves).not.toContain('exchange-profile-tab-reserves')
	})
})
