import type { TokenMatch, TokenOn } from '../data/tokenMatch'

// Match settings only affect results when a token is selected, so they are URL state only then.
// Both params stay out of the URL at their defaults.

/** The query after toggling one token; `draft` carries the match settings when the page offers them. */
export function toggleTokenQuery(
	selectedValues: Array<string>,
	value: string,
	wasSelected: boolean,
	draft: { mode: TokenMatch; on: TokenOn } | null
) {
	const token = wasSelected ? selectedValues.filter((v) => v !== value) : [...selectedValues, value]
	if (!draft) return { token }
	const hasSelection = token.length > 0
	return {
		token,
		tokenMatch: hasSelection && draft.mode !== 'exact' ? draft.mode : undefined,
		tokenOn: hasSelection && draft.on !== 'reference' ? draft.on : undefined
	}
}

/** Null while no token is selected: the choice stays a local draft until the first token commits it. */
export function matchModeQuery(next: TokenMatch, hasSelection: boolean) {
	return hasSelection ? { tokenMatch: next === 'exact' ? undefined : next } : null
}

export function matchOnQuery(next: TokenOn, hasSelection: boolean) {
	return hasSelection ? { tokenOn: next === 'reference' ? undefined : next } : null
}
