import type { IProtocolMetadata } from '~/utils/metadata/types'

export type OpenInterestKind = 'openInterest' | 'optionsOpenInterest'
type OpenInterestFlags = Pick<IProtocolMetadata, OpenInterestKind>

// A parent's open-interest endpoints add up every child, perp and options alike, and its total can lag its
// children's. So a parent with options open interest reads each kind from the children flagged for it, and any
// other protocol reads its own endpoints. Returns the protocols whose endpoints make up the kind.
export function selectOpenInterestProtocols(
	protocol: string,
	flags: OpenInterestFlags,
	children: ReadonlyArray<{ name: string; flags: OpenInterestFlags | undefined }>,
	kind: OpenInterestKind
): Array<string> {
	if (!flags.optionsOpenInterest || children.length === 0) return flags[kind] ? [protocol] : []
	return children.filter((child) => child.flags?.[kind]).map((child) => child.name)
}
