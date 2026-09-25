import type { InvestorsSite } from './config'

const MAIN_UMAMI_WEBSITE_ID = 'ca346731-f7ec-437f-9727-162f29bb67ae'
const MAIN_UMAMI_DOMAINS = 'defillama.com'

/**
 * Attributes of the Umami tracker script for the site from `useInvestorsSite()`: `null` is the main
 * site, and `undefined` (host not resolved yet) loads no tracker, so an IR host never reports to the
 * main site's website.
 */
export function getUmamiScriptAttributes(site: InvestorsSite | null | undefined) {
	if (site === undefined) return null
	return {
		'data-website-id': site?.umamiWebsiteId ?? MAIN_UMAMI_WEBSITE_ID,
		'data-host-url': 'https://tasty.defillama.com',
		// Only send from the site's real hosts, so localhost and preview deployments stay out of tasty.
		'data-domains': site?.umamiDomains.join(',') ?? MAIN_UMAMI_DOMAINS,
		'data-before-send': 'umamiABBeforeSend'
	}
}
