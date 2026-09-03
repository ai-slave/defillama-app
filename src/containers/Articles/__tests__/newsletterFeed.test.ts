import { describe, expect, it } from 'vitest'
import { parseResearchNewsletterFeed } from '~/containers/Articles/newsletterFeed.server'

describe('Beehiiv research newsletter feed', () => {
	it('extracts safe card metadata and ignores full email HTML', () => {
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
			<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
				<channel>
					<title>DefiLlama Research</title>
					<item>
						<title>DeFi&#39;s markets &amp; infrastructure</title>
						<description><![CDATA[Research Notes]]></description>
						<link>https://defillama-research.beehiiv.com/p/markets</link>
						<guid>newsletter-1</guid>
						<pubDate>Thu, 27 Aug 2026 18:10:12 +0000</pubDate>
						<enclosure url="https://media.beehiiv.com/thumbnail.png" type="image/png" />
						<content:encoded><![CDATA[<style>body { display: none }</style><script>unsafe()</script>]]></content:encoded>
					</item>
				</channel>
			</rss>`

		expect(parseResearchNewsletterFeed(xml)).toEqual([
			{
				id: 'newsletter-1',
				title: "DeFi's markets & infrastructure",
				description: 'Research Notes',
				href: 'https://defillama-research.beehiiv.com/p/markets',
				imageUrl: 'https://media.beehiiv.com/thumbnail.png',
				publishedAt: '2026-08-27T18:10:12.000Z'
			}
		])
	})

	it('drops unsafe item links and tolerates invalid optional metadata', () => {
		const xml = `<rss><channel>
			<item>
				<title>Unsafe item</title>
				<link>javascript:alert(1)</link>
			</item>
			<item>
				<title>Safe item</title>
				<link>https://defillama-research.beehiiv.com/p/safe</link>
				<pubDate>not a date</pubDate>
				<enclosure url="data:image/png;base64,unsafe" />
			</item>
		</channel></rss>`

		expect(parseResearchNewsletterFeed(xml)).toEqual([
			{
				id: 'https://defillama-research.beehiiv.com/p/safe',
				title: 'Safe item',
				description: null,
				href: 'https://defillama-research.beehiiv.com/p/safe',
				imageUrl: null,
				publishedAt: null
			}
		])
	})
})
