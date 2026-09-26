import { useRouter } from 'next/router'
import { useRef } from 'react'
import { readSelectionFromQuery, updateQueryFromSelected } from '~/components/Select/query'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import type { SelectTriggerSize } from '~/components/Select/types'
import { nestedMenuActionButtonStyles, popoverActionButtonStyles } from '~/ui/Popover'
import { trackYieldsEvent, YIELDS_EVENTS } from '~/utils/analytics/yields'
import { pushYieldsQuery } from '../queryUpdates.client'

const EMPTY_ARRAY: Array<string> = []

interface IFiltersByChainProps {
	chainList: Array<string>
	evmChains?: Array<string>
	nestedMenu?: boolean
	size?: SelectTriggerSize
}

export function FilterByChain({ chainList = EMPTY_ARRAY, evmChains, nestedMenu, size = 'sm' }: IFiltersByChainProps) {
	const router = useRouter()
	const selectedChains = readSelectionFromQuery(router.query, 'chain', 'excludeChain', chainList)
	const prevSelectionRef = useRef<Set<string>>(new Set(selectedChains))
	const evmSet = new Set(evmChains ?? EMPTY_ARRAY)
	const evmOptions = chainList.filter((chain) => evmSet.has(chain))
	const pushQueryUpdates = (updates: Record<string, string | Array<string> | undefined>) => {
		void pushYieldsQuery(router, updates)
	}

	// Checks the real EVM chains, so the selection, the URL and the request all name the same chains.
	const selectEvmChains = () => {
		trackYieldsEvent(YIELDS_EVENTS.FILTER_CHAIN, { chain: 'ALL_EVM' })
		prevSelectionRef.current = new Set(evmOptions)
		updateQueryFromSelected(router, 'chain', 'excludeChain', chainList, evmOptions, undefined, { pushQueryUpdates })
	}

	return (
		<SelectWithCombobox
			variant="default"
			label="Chains"
			allValues={chainList}
			includeQueryKey="chain"
			excludeQueryKey="excludeChain"
			pushQueryUpdates={pushQueryUpdates}
			onValuesChange={(values) => {
				for (const chain of values) {
					if (!prevSelectionRef.current.has(chain)) trackYieldsEvent(YIELDS_EVENTS.FILTER_CHAIN, { chain })
				}
				prevSelectionRef.current = new Set(values)
			}}
			customHeader={
				evmOptions.length > 0 ? (
					<button
						type="button"
						onClick={selectEvmChains}
						className={`w-full border-b border-subtle ${nestedMenu ? nestedMenuActionButtonStyles : popoverActionButtonStyles}`}
					>
						Only EVM chains
					</button>
				) : null
			}
			{...(nestedMenu !== undefined ? { nestedMenu } : {})}
			labelType={selectedChains.length === chainList.length ? 'none' : 'regular'}
			size={size}
		/>
	)
}
