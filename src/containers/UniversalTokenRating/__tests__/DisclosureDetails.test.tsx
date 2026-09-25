import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import { DisclosureDetails } from '../DisclosureDetails'
import { normalizeUtrDisclosures } from '../server'

const disclosures = normalizeUtrDisclosures({
	updatedAt: '2026-08-21T08:51:21.248Z',
	disclosures: {
		insiderIdentities: [
			{ name: 'Amir Haleem', role: 'Founder', profileUrl: 'https://x.com/amirhaleem', description: 'Chairman' },
			{ name: 'Anon', role: 'Dev', profileUrl: 'javascript:alert(1)', description: '' }
		],
		multisigWallets: [
			{
				walletAddress: '0x7951c7ef839e26F63DA87a42C9a87986507f1c07',
				thresholdRequired: '7',
				thresholdTotal: '12',
				signerNames: 'Alice, Bob'
			}
		],
		exchangeEngagements: [
			{ exchangeName: 'Binance', commercialCommitment: true, details: '5% allocation', commentary: 'internal note' }
		]
	}
})!

describe('UTR disclosure drawer details', () => {
	test('renders disclosed insiders and links only http profiles', () => {
		const html = renderToStaticMarkup(<DisclosureDetails criterionKey="team_identities" disclosures={disclosures} />)

		expect(html).toContain('Amir Haleem')
		expect(html).toContain('href="https://x.com/amirhaleem"')
		expect(html).toContain('javascript:alert(1)')
		expect(html).not.toContain('href="javascript:')
	})

	test('shows the quorum but not signer names or exchange commentary', () => {
		const multisig = renderToStaticMarkup(<DisclosureDetails criterionKey="multisigs" disclosures={disclosures} />)
		const exchanges = renderToStaticMarkup(
			<DisclosureDetails criterionKey="exchange_agreements" disclosures={disclosures} />
		)

		expect(multisig).toContain('7 of 12')
		expect(multisig).not.toContain('Alice, Bob')
		expect(exchanges).toContain('5% allocation')
		expect(exchanges).not.toContain('internal note')
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
