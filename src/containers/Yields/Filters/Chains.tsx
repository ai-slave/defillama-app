import { useRouter } from 'next/router'
import { useRef } from 'react'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import type { SelectOption, SelectTriggerSize } from '~/components/Select/types'
import { trackYieldsEvent, YIELDS_EVENTS } from '~/utils/analytics/yields'
import { pushYieldsQuery } from '../queryUpdates.client'

const EMPTY_ARRAY: string[] = []

interface IFiltersByChainProps {
	chainList: string[]
	selectedChains: string[]
	evmChains?: string[]
	nestedMenu?: boolean
	size?: SelectTriggerSize
}

export function FilterByChain({
	chainList = EMPTY_ARRAY,
	selectedChains,
	evmChains,
	nestedMenu,
	size
}: IFiltersByChainProps) {
	const router = useRouter()
	const { chain } = router.query
	const prevSelectionRef = useRef<Set<string> | null>(null)
	const evmChainsSet = new Set(evmChains ?? EMPTY_ARRAY)
	const isEvmChain = (c: string) => evmChainsSet.has(c) || evmChainsSet.has(c.toLowerCase())
	const pushFilterQuery = (updates: Record<string, string | string[] | undefined>) => pushYieldsQuery(router, updates)

	// Add ALL_EVM as the first option in the chain list. It's a synthetic group option, so
	// its emitted value / URL param stays 'ALL_EVM' (unchanged); only the display label is
	// humanised to 'All EVM' via the {key,name} option form.
	const chainListWithSpecial: SelectOption[] = [
		{ key: 'ALL_EVM', name: 'All EVM' },
		...chainList.map((chainName) => ({ key: chainName, name: chainName }))
	]

	// Check if ALL_EVM is in the URL query
	const isAllEvmSelected = chain === 'ALL_EVM' || (Array.isArray(chain) && chain.includes('ALL_EVM'))

	// For display: if ALL_EVM is in the URL, show it as selected along with the expanded chains
	let displaySelectedChains = selectedChains
	if (isAllEvmSelected) {
		displaySelectedChains = ['ALL_EVM']
		for (const c of selectedChains) {
			if (c !== 'ALL_EVM') displaySelectedChains.push(c)
		}
	}

	// Custom handler for ALL_EVM select/deselect
	const handleValuesChange = (newValues: string[]) => {
		const prevValues = displaySelectedChains
		const prevHadAllEvm = prevValues.includes('ALL_EVM')
		const newHasAllEvm = newValues.includes('ALL_EVM')

		let finalValues: string[]

		const justAddedAllEvm = !prevHadAllEvm && newHasAllEvm
		const prevChainsWithoutAllEvm = new Set<string>()
		for (const c of prevValues) {
			if (c !== 'ALL_EVM') prevChainsWithoutAllEvm.add(c)
		}
		let chainsWereAdded = false
		for (const c of newValues) {
			if (c !== 'ALL_EVM' && !prevChainsWithoutAllEvm.has(c)) {
				chainsWereAdded = true
				break
			}
		}
		// It's "Select All" if all options selected AND (chains were added OR ALL_EVM wasn't just added)
		// This means: it's NOT Select All only when the ONLY change was adding ALL_EVM
		const isSelectAll = newValues.length === chainList.length + 1 && (chainsWereAdded || !justAddedAllEvm)

		if (isSelectAll) {
			// Select all - use all actual chains, not ALL_EVM
			finalValues = [...chainList]
			prevSelectionRef.current = new Set(finalValues)
		} else if (justAddedAllEvm) {
			finalValues = ['ALL_EVM']

			// Track ALL_EVM selection and set prevSelectionRef to all EVM chains
			// This ensures that when adding another chain (e.g., Solana), only the new chain is tracked
			trackYieldsEvent(YIELDS_EVENTS.FILTER_CHAIN, { chain: 'ALL_EVM' })
			prevSelectionRef.current = new Set(evmChains ?? [])
		} else if (prevHadAllEvm && !newHasAllEvm) {
			// ALL_EVM was just deselected - remove all EVM chains
			finalValues = []
			for (const c of newValues) {
				if (c !== 'ALL_EVM' && !isEvmChain(c)) finalValues.push(c)
			}
		} else {
			// Normal selection change
			finalValues = []
			for (const c of newValues) {
				if (c !== 'ALL_EVM') finalValues.push(c)
			}
		}

		// Track analytics (skip if ALL_EVM was just selected or select all - already tracked above)
		const skipTracking = isSelectAll || justAddedAllEvm
		if (!skipTracking) {
			const prevSet = prevSelectionRef.current ?? new Set(displaySelectedChains)
			for (const c of finalValues) {
				if (!prevSet.has(c)) {
					trackYieldsEvent(YIELDS_EVENTS.FILTER_CHAIN, { chain: c })
				}
			}
			prevSelectionRef.current = new Set(finalValues)
		}

		if (finalValues.length === 0) {
			void pushFilterQuery({
				chain: 'None',
				excludeChain: undefined
			})
			return
		}
		if (finalValues.length === chainList.length) {
			// All selected - remove chain params (default = all)
			void pushFilterQuery({
				chain: undefined,
				excludeChain: undefined
			})
			return
		}
		if (finalValues.includes('ALL_EVM')) {
			void pushFilterQuery({
				chain: 'ALL_EVM',
				excludeChain: undefined
			})
			return
		}

		// Specific chains selected - use include or exclude based on which is shorter
		const finalValuesSet = new Set(finalValues)
		const excluded = []
		for (const c of chainList) {
			if (!finalValuesSet.has(c)) excluded.push(c)
		}
		if (excluded.length < finalValues.length) {
			void pushFilterQuery({
				chain: undefined,
				excludeChain: excluded.length === 1 ? excluded[0] : excluded
			})
			return
		}

		void pushFilterQuery({
			chain: finalValues.length === 1 ? finalValues[0] : finalValues,
			excludeChain: undefined
		})
	}

	return (
		<SelectWithCombobox
			variant="default"
			label="Chains"
			allValues={chainListWithSpecial}
			selectedValues={displaySelectedChains}
			setSelectedValues={handleValuesChange}
			nestedMenu={nestedMenu}
			labelType={!chain || chain === 'All' ? 'none' : 'regular'}
			size={size}
		/>
	)
}
