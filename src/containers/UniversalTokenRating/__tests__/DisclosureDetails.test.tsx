import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import { DisclosureDetails, httpHref } from '../DisclosureDetails'
import { normalizeUtrDisclosures } from '../server'

const disclosures = normalizeUtrDisclosures({
	updatedAt: '2026-08-21T08:51:21.248Z',
	disclosures: {
		multisigWallets: [
			{
				walletAddress: '0x7951c7ef839e26F63DA87a42C9a87986507f1c07',
				thresholdRequired: '7',
				thresholdTotal: '12'
			}
		]
	}
})!

describe('httpHref', () => {
	test('links only http and https urls', () => {
		expect(['https://x.io', 'http://x.io', 'HTTPS://X.IO', 'javascript:alert(1)', 'x.io', null].map(httpHref)).toEqual([
			'https://x.io',
			'http://x.io',
			'HTTPS://X.IO',
			null,
			null,
			null
		])
	})
})

describe('UTR disclosure drawer details', () => {
	test('shows the multisig quorum as required of total signers', () => {
		expect(renderToStaticMarkup(<DisclosureDetails criterionKey="multisigs" disclosures={disclosures} />)).toContain(
			'7 of 12'
		)
	})

	test('shows the empty state for a criterion with nothing disclosed', () => {
		expect(
			renderToStaticMarkup(<DisclosureDetails criterionKey="smart_contract_audits" disclosures={disclosures} />)
		).toContain('Data not disclosed')
		expect(renderToStaticMarkup(<DisclosureDetails criterionKey="unknown_criterion" disclosures={disclosures} />)).toBe(
			''
		)
	})
})
