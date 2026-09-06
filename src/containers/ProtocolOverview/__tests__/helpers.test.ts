import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { useFinalTVL } from '../helpers'

let tvlSettings: Record<string, boolean> = {}
let localStorageSettingKeys: Array<string> = []

vi.mock('~/contexts/LocalStorage', async (importOriginal) => {
	const actual = await importOriginal<typeof import('~/contexts/LocalStorage')>()
	return {
		...actual,
		useLocalStorageSettingsManager: (settingsKey: string) => {
			localStorageSettingKeys.push(settingsKey)
			return [tvlSettings]
		}
	}
})

const baseProtocolOverviewData = {
	currentTvlByChain: null,
	oracleTvs: null
}

type FinalTvlProps = Parameters<typeof useFinalTVL>[0]

function FinalTvlProbe({
	props,
	onResult
}: {
	props: FinalTvlProps
	onResult: (result: ReturnType<typeof useFinalTVL>) => void
}) {
	onResult(useFinalTVL(props))
	return null
}

function getFinalTvlResult(props: FinalTvlProps) {
	const results: Array<ReturnType<typeof useFinalTVL>> = []

	renderToStaticMarkup(
		createElement(FinalTvlProbe, {
			props,
			onResult: (value) => {
				results.push(value)
			}
		})
	)

	const result = results[0]
	if (!result) throw new Error('Final TVL probe did not render')
	return result
}

beforeEach(() => {
	tvlSettings = {}
	localStorageSettingKeys = []
})

describe('useFinalTVL', () => {
	test('adds enabled protocol overview TVL suffix extras while preserving chain hyphen suffixes', () => {
		tvlSettings = { staking: true, pool2: true, borrowed: false }

		const result = getFinalTvlResult({
			...baseProtocolOverviewData,
			currentTvlByChain: {
				Ethereum: 100,
				'Arbitrum-staking': 20,
				'Base-pool2': 30,
				'OP-Mainnet': 7,
				borrowed: 9
			}
		})

		expect(localStorageSettingKeys).toEqual(['tvl'])
		expect(result.tvl).toBe(157)
		expect(result.tvlByChain).toEqual([
			['Ethereum', 100],
			['Base', 30],
			['Arbitrum', 20],
			['OP-Mainnet', 7]
		])
		expect(result.toggleOptions.map((option) => option.key)).toEqual(['staking', 'pool2', 'borrowed'])
	})

	test('keeps disabled protocol overview TVL extras out of totals but exposes their toggle options', () => {
		tvlSettings = { staking: false, borrowed: false }

		const result = getFinalTvlResult({
			...baseProtocolOverviewData,
			currentTvlByChain: {
				Ethereum: 100,
				'Ethereum-staking': 20,
				borrowed: 9
			}
		})

		expect(localStorageSettingKeys).toEqual(['tvl'])
		expect(result.tvl).toBe(100)
		expect(result.tvlByChain).toEqual([['Ethereum', 100]])
		expect(result.toggleOptions.map((option) => option.key)).toEqual(['staking', 'borrowed'])
	})

	test('does not expose or aggregate chain-only TVL settings on protocol surfaces', () => {
		tvlSettings = { doublecounted: true, liquidstaking: true, govtokens: true }

		const result = getFinalTvlResult({
			...baseProtocolOverviewData,
			currentTvlByChain: {
				Ethereum: 100,
				'Ethereum-doublecounted': 20,
				'Base-liquidstaking': 30,
				govtokens: 40
			}
		})

		expect(result.tvl).toBe(100)
		expect(result.tvlByChain).toEqual([['Ethereum', 100]])
		expect(result.toggleOptions).toEqual([])
	})

	test('applies TVL toggles to oracle TVS aggregation', () => {
		tvlSettings = { staking: true, pool2: false }

		const result = getFinalTvlResult({
			...baseProtocolOverviewData,
			oracleTvs: {
				Ethereum: 200,
				'Ethereum-staking': 30,
				'Ethereum-pool2': 40
			}
		})

		expect(localStorageSettingKeys).toEqual(['tvl'])
		expect(result.oracleTvs).toBe(230)
		expect(result.oracleTvsByChain).toEqual([['Ethereum', 230]])
		expect(result.toggleOptions.map((option) => option.key)).toEqual(['staking', 'pool2'])
	})
})
