import { describe, expect, test } from 'vitest'
import { buildUtrClaimRequest, validateUtrClaimFiles, type UtrClaimRequestInput } from '../claimRequest'

function validInput(): UtrClaimRequestInput {
	return {
		coingeckoId: 'uniswap',
		tokenName: ' Uniswap ',
		tokenTicker: ' UNI ',
		firstName: ' Alice ',
		lastName: ' Example ',
		position: ' Core Contributor ',
		profileUrl: 'x.com/alice',
		email: ' alice@uniswap.org ',
		telegram: ' @alice ',
		rows: {
			insiderIdentities: [],
			organizationalStructure: [],
			insiderWallets: [],
			tokenomicsGroups: [],
			externalAllocations: [],
			multisigWallets: [],
			licenses: [],
			marketMakerEngagements: [],
			exchangeEngagements: [],
			auditors: []
		},
		verifyMmEngagements: true,
		documents: {
			teamOrg: [],
			tokenomics: [],
			treasuryCashFlows: [],
			legal: [],
			serviceProviders: [],
			alignment: [
				{
					key: 'utr-claims/claim/affiliation.txt',
					fileName: 'affiliation.txt',
					mimeType: 'text/plain',
					sizeBytes: 42,
					signature: 'signed-verbatim',
					storageRegion: 'keep-this-field'
				}
			]
		},
		alignmentConsent: true,
		termsConsent: true,
		turnstileToken: ' claim-token ',
		clickId: ' click-123 '
	}
}

describe('buildUtrClaimRequest', () => {
	test('builds the strict Forgd claim contract and keeps upload receipts verbatim', () => {
		const input = validInput()
		input.rows.insiderIdentities = [
			{ name: 'Alice Example', role: 'Founder', profileUrl: 'https://www.linkedin.com/in/alice' }
		]
		input.rows.tokenomicsGroups = [
			{
				groupName: 'Core Contributors',
				allocationPct: '20',
				groupCategory: 'Founders & Team',
				tgeUnlockPct: '0',
				lockUpDurationMonths: '12',
				cliffUnlockPct: '10',
				unlockDurationMonths: '24',
				unlockFrequency: 'Monthly'
			}
		]

		const result = buildUtrClaimRequest(input)

		expect(result.errors).toEqual({})
		expect(result.payload).toMatchObject({
			coingeckoId: 'uniswap',
			tokenName: 'Uniswap',
			tokenTicker: 'UNI',
			firstName: 'Alice',
			lastName: 'Example',
			position: 'Core Contributor',
			socialProfileUrl: 'https://x.com/alice',
			email: 'alice@uniswap.org',
			telegram: '@alice',
			clickId: 'click-123',
			turnstileToken: 'claim-token',
			alignmentConsent: true,
			termsConsent: true
		})
		expect(result.payload?.disclosures.insiderIdentities).toEqual([
			{ name: 'Alice Example', role: 'Founder', profileUrl: 'https://www.linkedin.com/in/alice' }
		])
		expect(result.payload?.disclosures.tokenomicsGroups[0]).toEqual({
			groupName: 'Core Contributors',
			allocationPct: 20,
			groupCategory: 'Founders & Team',
			tgeUnlockPct: 0,
			lockUpDurationMonths: 12,
			cliffUnlockPct: 10,
			unlockDurationMonths: 24,
			unlockFrequency: 'Monthly'
		})
		expect(result.payload?.documents.alignment).toEqual(input.documents.alignment)
		expect(Object.keys(result.payload ?? {}).sort()).toEqual(
			[
				'alignmentConsent',
				'clickId',
				'coingeckoId',
				'disclosures',
				'documents',
				'email',
				'firstName',
				'lastName',
				'position',
				'socialProfileUrl',
				'telegram',
				'termsConsent',
				'tokenName',
				'tokenTicker',
				'turnstileToken'
			].sort()
		)
		expect(result.payload).not.toHaveProperty('turnstile_token')
	})

	test('turns untouched rows into empty arrays and omits empty optional fields', () => {
		const input = validInput()
		input.coingeckoId = null
		input.tokenTicker = ''
		input.profileUrl = ''
		input.telegram = ''
		input.clickId = null
		input.turnstileToken = ''
		const result = buildUtrClaimRequest(input)

		expect(result.errors).toEqual({})
		expect(result.payload?.coingeckoId).toBeNull()
		expect(result.payload).not.toHaveProperty('tokenTicker')
		expect(result.payload).not.toHaveProperty('socialProfileUrl')
		expect(result.payload).not.toHaveProperty('telegram')
		expect(result.payload).not.toHaveProperty('clickId')
		expect(result.payload).not.toHaveProperty('turnstileToken')
		expect(result.payload?.disclosures.insiderIdentities).toEqual([])
		expect(result.payload?.disclosures.auditors).toEqual([])
	})

	test('rejects partially filled and invalid numeric rows', () => {
		const input = validInput()
		input.rows.insiderIdentities = [{}, { name: 'Alice', role: '', profileUrl: '' }]
		input.rows.multisigWallets = [
			{ walletAddress: '0x123', thresholdRequired: '6', thresholdTotal: '5', signerNames: 'Alice, Bob' }
		]
		const result = buildUtrClaimRequest(input)

		expect(result.payload).toBeNull()
		expect(result.errors['insiderIdentities.1.role']).toBe('Role is required')
		expect(result.errors['multisigWallets.0.thresholdRequired']).toContain('must not exceed')
	})
})

describe('validateUtrClaimFiles', () => {
	const file = (name: string, size: number) => ({ name, size }) as File

	test('accepts supported files and enforces count, extension, and size', () => {
		expect(validateUtrClaimFiles([file('evidence.pdf', 100)], 0)).toBeNull()
		expect(validateUtrClaimFiles([file('evidence.exe', 100)], 0)).toContain('supported formats')
		expect(validateUtrClaimFiles([file('large.pdf', 10 * 1024 * 1024 + 1)], 0)).toContain('10 MB')
		expect(validateUtrClaimFiles([file('extra.md', 100)], 10)).toContain('No more than 10')
	})
})
