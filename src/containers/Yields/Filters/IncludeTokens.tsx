import { useRouter } from 'next/router'
import { useState } from 'react'
import { Button } from '~/ui/Button'
import { passFocusOnLeave } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { Tooltip } from '~/ui/Tooltip'
import { trackYieldsEvent, YIELDS_EVENTS } from '~/utils/analytics/yields'
import { TOKEN_MATCHES, TOKEN_ONS, type TokenMatch, type TokenOn } from '../data/tokenMatch'
import type { TokenOption } from '../data/types'
import { pushYieldsQuery } from '../queryUpdates.client'
import { matchModeQuery, matchOnQuery, toggleTokenQuery } from './includeTokensQuery'
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
	compact = false,
	resultCount,
	...props
}: {
	tokens: Array<TokenOption>
	placeholder?: string
	matchOn?: boolean
	/** Pools matching the current query, shown live in the dialog footer. */
	resultCount?: number
	/** Fixed-width icon trigger; the pill, and any token label, would claim a whole phone row. */
	compact?: boolean
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
		if (!wasSelected) trackYieldsEvent(YIELDS_EVENTS.SEARCH_TOKEN_INCLUDE, { token: value })
		void pushYieldsQuery(
			router,
			toggleTokenQuery(selectedValues, value, wasSelected, matchOn ? { mode: draftMode, on: draftOn } : null)
		)
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
					const update = matchModeQuery(next, hasSelection)
					if (update) void pushYieldsQuery(router, update)
				},
				onOnChange: (next) => {
					if (next !== draftOn) trackYieldsEvent(YIELDS_EVENTS.SEARCH_TOKEN_ON, { on: next })
					setDraftOn(next)
					const update = matchOnQuery(next, hasSelection)
					if (update) void pushYieldsQuery(router, update)
				}
			}
		: undefined

	// Active-state label for the pill: the first selected token symbol (+n for the rest).
	const clearable = hasSelection

	const firstSelectedName = hasSelection ? (nameByValue.get(selectedValues[0]!) ?? selectedValues[0]!) : null

	const dialog = open ? (
		<TokenSearchDialog
			onClose={() => setOpen(false)}
			title="Search tokens"
			options={tokens}
			selectedValues={selectedValues}
			multiple
			onToggle={toggleToken}
			onClear={clearAll}
			placeholder={placeholder}
			{...(match ? { match } : {})}
			{...(resultCount != null ? { resultCount } : {})}
		/>
	) : null

	if (compact) {
		return (
			<>
				<Tooltip
					content={
						firstSelectedName
							? `Tokens: ${firstSelectedName}${selectedValues.length > 1 ? ` and ${selectedValues.length - 1} more` : ''}`
							: 'Filter by token'
					}
					render={
						<Button
							type="button"
							variant={hasSelection ? 'outline' : 'secondary'}
							size="md"
							square
							onClick={openDialog}
							aria-label={
								firstSelectedName
									? `Tokens: ${firstSelectedName}${selectedValues.length > 1 ? ` and ${selectedValues.length - 1} more` : ''}`
									: 'Filter by token'
							}
						/>
					}
				>
					<Icon name="search" height={16} width={16} className="shrink-0" />
				</Tooltip>
				{dialog}
			</>
		)
	}

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
							<span className="truncate">{firstSelectedName}</span>
							{selectedValues.length > 1 ? (
								<span className="shrink-0 label-xs text-tertiary">+{selectedValues.length - 1}</span>
							) : null}
						</span>
					) : (
						<span className="flex-1 text-left">{placeholder}</span>
					)}
				</button>
				{clearable ? (
					<Tooltip
						content="Clear selected tokens"
						render={
							<Button
								size="sm"
								variant="ghost"
								square
								// Clearing removes this button: the picker beside it takes focus.
								ref={passFocusOnLeave((node) => node.previousElementSibling as HTMLElement)}
								className="mr-1"
								aria-label="Clear selected tokens"
								onClick={clearAll}
							/>
						}
					>
						<Icon name="x" className="size-4" />
					</Tooltip>
				) : null}
			</div>

			{dialog}
		</>
	)
}
