import type { BlockExplorersResponse } from '~/api/types'
import { findBlockExplorerChain } from '~/utils/blockExplorers'

// Chain name → numeric id comes from the block-explorers API already flowing through the
// section — never a hardcoded chain map. Null (unknown / non-EVM chain) → placeholder.
export function tokenIconByAddress(
	explorers: BlockExplorersResponse | undefined,
	chain: string,
	address: string,
	size = 48
): string | null {
	const evmChainId = explorers ? findBlockExplorerChain(explorers, { chainName: chain })?.evmChainId : null
	if (!evmChainId || !address) return null
	return `https://token-icons.llamao.fi/icons/tokens/${evmChainId}/${address.toLowerCase()}?w=${size}&h=${size}`
}
