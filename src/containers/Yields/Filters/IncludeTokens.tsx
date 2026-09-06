import { useRouter } from 'next/router'
import { useState } from 'react'
import { Icon } from '~/ui/Icon'
import { iconHitTargetStyles } from '~/ui/IconHitTarget'
import { trackYieldsEvent, YIELDS_EVENTS } from '~/utils/analytics/yields'
import { TOKEN_MATCHES, TOKEN_ONS, type TokenMatch, type TokenOn } from '../data/tokenMatch'
import type { TokenOption } from '../data/types'
import { pushYieldsQuery } from '../queryUpdates.client'
import { type MatchConfig, TokenSearchDialog } from './TokenSearchDialog'

// Token search entry point for the /yields (earn) and /yields/loop pages. The pill
// opens the shared TokenSearchDialog; selections are include-only option keys pushed to
// `token=` (repeatable). When `matchOn` is set (earn), the dialog also exposes the
// Match (exact/contains/set) × On (reference/pool/both) query builder, committed to
// `tokenMatch=` / `tokenOn=` (both param-free at their defaults).

function toArray(value: string | Array<string> | undefined): Array<string> {
	if (typeof value === 'string') return [value]
	return Array.isArray(value) ? [...value] : []
}

function readMatch(value: string | Array<string> | undefined): TokenMatch {
	const v = typeof value === 'string' ? value : undefined
	return TOKEN_MATCHES.includes(v as TokenMatch) ? (v as TokenMatch) : 'exact'
}
function readOn(value: string | Array<string> | undefined): TokenOn {
	const v = typeof value === 'string' ? value : undefined
	return TOKEN_ONS.includes(v as TokenOn) ? (v as TokenOn) : 'reference'
}
export function IncludeTokens({
	tokens,
	placeholder = 'Search tokens',
	matchOn = false,
	...props
}: {
	tokens: Array<TokenOption>
	placeholder?: string
	matchOn?: boolean
}) {
	const router = useRouter()
	const [open, setOpen] = useState(false)

	const selectedValues = toArray(router.query.token)
	const hasSelection = selectedValues.length > 0
	const nameByValue = new Map<string, string>()
	for (const [name, value] of tokens) nameByValue.set(value, name)

	const committedMode = matchOn ? readMatch(router.query.tokenMatch) : 'exact'
	const committedOn = matchOn ? readOn(router.query.tokenOn) : 'reference'
	// Match settings only affect results when a token is selected. Keep dormant
	// choices local so configuring an empty filter does not rerun the page query.
	const [draftMode, setDraftMode] = useState<TokenMatch>(committedMode)
	const [draftOn, setDraftOn] = useState<TokenOn>(committedOn)

	const openDialog = () => {
		if (hasSelection) {
			setDraftMode(committedMode)
			setDraftOn(committedOn)
		}
		setOpen(true)
	}

	const toggleToken = (value: string, wasSelected: boolean) => {
		const next = wasSelected ? selectedValues.filter((v) => v !== value) : [...selectedValues, value]
		const hasNextSelection = next.length > 0
		if (!wasSelected) trackYieldsEvent(YIELDS_EVENTS.SEARCH_TOKEN_INCLUDE, { token: value })
		void pushYieldsQuery(router, {
			token: next,
			...(matchOn
				? {
						tokenMatch: hasNextSelection && draftMode !== 'exact' ? draftMode : undefined,
						tokenOn: hasNextSelection && draftOn !== 'reference' ? draftOn : undefined
					}
				: {})
		})
	}

	const clearAll = () => {
		void pushYieldsQuery(router, {
			token: [],
			...(matchOn ? { tokenMatch: undefined, tokenOn: undefined } : {})
		})
	}

	const match: MatchConfig | undefined = matchOn
		? {
				mode: draftMode,
				on: draftOn,
				onModeChange: (next) => {
					if (next !== draftMode) trackYieldsEvent(YIELDS_EVENTS.SEARCH_TOKEN_MATCH, { match: next })
					setDraftMode(next)
					if (hasSelection) void pushYieldsQuery(router, { tokenMatch: next === 'exact' ? undefined : next })
				},
				onOnChange: (next) => {
					if (next !== draftOn) trackYieldsEvent(YIELDS_EVENTS.SEARCH_TOKEN_ON, { on: next })
					setDraftOn(next)
					if (hasSelection) void pushYieldsQuery(router, { tokenOn: next === 'reference' ? undefined : next })
				}
			}
		: undefined

	// Active-state label for the pill: the first selected token symbol (+n for the rest).
	const clearable = hasSelection

	return (
		<>
			<div
				className="hover-wash hidden min-h-8 w-full items-center rounded-lg border border-medium bg-page body-sm text-primary focus-within:border-brand data-[alwaysdisplay=true]:flex sm:flex sm:w-auto sm:min-w-56"
				{...props}
			>
				<button
					type="button"
					onClick={openDialog}
					className="flex min-w-0 flex-1 items-center gap-2 px-3 py-1.5 text-left outline-hidden"
				>
					<Icon name="search" height={16} width={16} />
					{hasSelection ? (
						<span className="flex min-w-0 flex-1 items-center gap-1 text-left text-primary">
							<span className="truncate">{nameByValue.get(selectedValues[0]!) ?? selectedValues[0]!}</span>
							{selectedValues.length > 1 ? (
								<span className="shrink-0 label-xs text-tertiary">+{selectedValues.length - 1}</span>
							) : null}
						</span>
					) : (
						<span className="flex-1 text-left">{placeholder}</span>
					)}
				</button>
				{clearable ? (
					<button
						type="button"
						className={`${iconHitTargetStyles} mr-1`}
						aria-label="Clear selected tokens"
						onClick={clearAll}
					>
						<Icon name="x" height={14} width={14} />
					</button>
				) : null}
			</div>

			{open ? (
				<TokenSearchDialog
					open
					onClose={() => setOpen(false)}
					title="Search tokens"
					options={tokens}
					selectedValues={selectedValues}
					multiple
					onToggle={toggleToken}
					onClear={clearAll}
					placeholder={placeholder}
					{...(match ? { match } : {})}
				/>
			) : null}
		</>
	)
}
