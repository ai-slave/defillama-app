import { useRouter } from 'next/router'
import { useState } from 'react'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { iconHitTargetStyles } from '~/ui/IconHitTarget'
import { Tooltip } from '~/ui/Tooltip'
import type { TokenOption } from '../data/types'
import { pushYieldsQuery } from '../queryUpdates.client'
import { TokenSearchDialog } from './TokenSearchDialog'

// Two single-select token pickers (Collateral / Borrow) for the /yields/borrow page,
// plus a swap control. Each emits its own URL param (`collateralToken` / `borrowToken`)
// with a single option key (same key space the borrow route filters on). A selection on
// either side flips the page into routes mode. They share the token search dialog
// (GROUPS / ASSETS sections) but keep their fixed role — no Match / On query builder.

function readSingle(value: string | string[] | undefined): string | null {
	if (typeof value === 'string') return value
	return Array.isArray(value) ? (value[0] ?? null) : null
}

const SwapIcon = () => (
	<svg
		width="15"
		height="15"
		viewBox="0 0 16 16"
		fill="none"
		stroke="currentColor"
		strokeWidth="1.5"
		strokeLinecap="round"
		strokeLinejoin="round"
		aria-hidden
	>
		<path d="M4 3 L1.5 5.5 L4 8" />
		<path d="M1.5 5.5 H12" />
		<path d="M12 13 L14.5 10.5 L12 8" />
		<path d="M14.5 10.5 H4" />
	</svg>
)

function TokenSearchField({
	queryKey,
	label,
	placeholder,
	tokens
}: {
	queryKey: 'collateralToken' | 'borrowToken'
	label: string
	placeholder: string
	tokens: TokenOption[]
}) {
	const router = useRouter()
	const [open, setOpen] = useState(false)
	const selected = readSingle(router.query[queryKey])
	const nameByValue = new Map<string, string>()
	for (const [name, value] of tokens) nameByValue.set(value, name)

	const select = (value: string | undefined) => {
		void pushYieldsQuery(router, { [queryKey]: value })
	}

	return (
		<>
			<div className="hover-wash flex min-h-8 w-full min-w-0 items-center rounded-lg border border-medium bg-page body-sm text-primary focus-within:border-brand sm:w-56">
				<button
					type="button"
					onClick={() => setOpen(true)}
					aria-label={selected ? `${label}: ${nameByValue.get(selected) ?? selected}` : placeholder}
					className="flex min-w-0 flex-1 items-center gap-2 px-3 py-1.5 text-left outline-hidden"
				>
					<Icon name="search" height={16} width={16} />
					{selected ? (
						<span className="min-w-0 flex-1 truncate text-left text-primary">
							<span className="whitespace-nowrap text-secondary">{label}: </span>
							{nameByValue.get(selected) ?? selected}
						</span>
					) : (
						<span className="min-w-0 flex-1 truncate text-left">{placeholder}</span>
					)}
				</button>
				{selected ? (
					<button
						type="button"
						onClick={() => select(undefined)}
						className={`${iconHitTargetStyles} mr-1`}
						aria-label={`Clear ${label.toLowerCase()} token`}
					>
						<Icon name="x" height={14} width={14} />
					</button>
				) : null}
			</div>
			{open ? (
				<TokenSearchDialog
					open
					onClose={() => setOpen(false)}
					title={`Search ${label.toLowerCase()} token`}
					options={tokens}
					selectedValues={selected ? [selected] : []}
					multiple={false}
					onToggle={(value, wasSelected) => {
						select(wasSelected ? undefined : value)
						setOpen(false)
					}}
					onClear={() => select(undefined)}
					placeholder={placeholder}
				/>
			) : null}
		</>
	)
}

export function BorrowTokenPickers({
	collateralTokens,
	borrowTokens
}: {
	collateralTokens: TokenOption[]
	borrowTokens: TokenOption[]
}) {
	const router = useRouter()
	const collateral = readSingle(router.query.collateralToken)
	const borrow = readSingle(router.query.borrowToken)

	const swap = () => {
		void pushYieldsQuery(router, { collateralToken: borrow ?? undefined, borrowToken: collateral ?? undefined })
	}

	return (
		<div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
			<TokenSearchField
				queryKey="collateralToken"
				label="Collateral"
				placeholder="Search collateral token"
				tokens={collateralTokens}
			/>
			<Tooltip
				content="Swap collateral and borrow tokens"
				render={
					<Button
						type="button"
						variant="secondary"
						size="md"
						square
						onClick={swap}
						disabled={!collateral && !borrow}
						aria-label="Swap collateral and borrow tokens"
					/>
				}
			>
				<SwapIcon />
			</Tooltip>
			<TokenSearchField queryKey="borrowToken" label="Borrow" placeholder="Search borrow token" tokens={borrowTokens} />
		</div>
	)
}
