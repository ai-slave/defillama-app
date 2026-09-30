import { Bookmark } from '~/components/Bookmark'
import { BasicLink } from '~/components/Link'
import { usePaginatedTableDisplayRowNumber } from '~/components/Table/PaginatedTable'
import { TokenLogo } from '~/components/TokenLogo'
import { Icon } from '~/ui/Icon'
import { Tooltip } from '~/ui/Tooltip'
import { trackUmamiEvent } from '~/utils/analytics/umami'
import { formatUsd } from '~/utils/numberFormat'
import { DepegWarningIcon } from './YieldsCells'

interface INameYield {
	project: string
	projectslug?: string | undefined
	airdrop?: boolean | undefined
	raiseValuationUsd?: number | null | undefined
}

// Quiet external-link glyph (text-tertiary → link on hover) in the leading rail,
// so it sits at a constant x on every row.
function PoolExternalLink({ url, name, poolId }: { url: string; name: string; poolId: string }) {
	return (
		<a
			href={url}
			target="_blank"
			rel="noopener noreferrer"
			aria-label="Open external pool"
			onClick={() => trackUmamiEvent('yields-pool-external-link', { pool: name, pool_id: poolId })}
			className="shrink-0 text-tertiary transition-colors hover:text-link"
		>
			<Icon name="external-link" height={14} width={14} />
		</a>
	)
}

/**
 * Stacked pool/market/route/token name cell: a lockup — symbol (link color) over a
 * small secondary detail line (poolMeta) — with an optional leading bookmark, a
 * quiet inline external-link glyph, and a pagination-aware rank number at the lead.
 *
 */
export function PoolNameLockup({
	value,
	configID,
	url,
	poolMeta,
	bookmark = true,
	exploited = false,
	rowId,
	pegDeviation,
	pegTokenSymbol,
	pegConsequence,
	hasRiskData = false
}: {
	value: string
	configID: string
	url?: string | null
	poolMeta?: string | null
	hasRiskData?: boolean | undefined
	bookmark?: boolean
	exploited?: boolean | undefined
	rowId?: string
	pegDeviation?: number | null | undefined
	pegTokenSymbol?: string | null | undefined
	pegConsequence?: string | undefined
}) {
	// Inline rank: number inside the name cell (no dedicated column, so table-layout:fixed
	// can't balloon the gap), min-w-4 slot; longer ranks simply grow and nudge the content.
	const rowNumber = usePaginatedTableDisplayRowNumber(rowId ?? '')
	const poolUrl = `/yields/pool/${configID}`
	// Fixed two-deck height (36px = h-9, from the 14px primary + 12px secondary lines). The lockup is
	// vertically centered so a name WITHOUT a detail line reserves exactly the same height as one
	// WITH it — every row is identical regardless of poolMeta presence, and this name cell is the
	// tallest cell so it fixes the whole row height across all yields tables.
	//
	// Layout: a single `items-center` flex row — bookmark, the truncating (min-w-0) two-line
	// symbol/detail link and an optional depeg icon hugging the name. The external-link
	// glyph sits centered right after the row number (main's anatomy): constant x on every
	// row, vertically centered by the row's items-center. The exploit triangle and the
	// risk-report shield sit in a trailing group (ml-auto) so they align down the column.
	return (
		<span className="flex h-9 min-w-0 items-center gap-2">
			{bookmark ? (
				<Bookmark size="sm" readableName={value} configID={configID} className="-my-1 -mr-1 -ml-2 hidden lg:flex" />
			) : null}
			{rowId != null && rowNumber != null ? (
				<span className="inline-block min-w-4 shrink-0 text-left text-secondary">{rowNumber}</span>
			) : null}
			{url ? <PoolExternalLink url={url} name={value} poolId={configID} /> : null}
			<BasicLink
				href={poolUrl}
				target="_blank"
				rel="noopener noreferrer"
				data-umami-event="yields-pool-click"
				className="flex min-w-0 flex-col items-start leading-tight"
				aria-label={`View ${value} pool`}
			>
				<Tooltip content={value} className="max-w-full">
					<span className="truncate font-medium text-link hover:underline">{value}</span>
				</Tooltip>
				{poolMeta ? (
					<Tooltip content={poolMeta} className="block! max-w-full truncate body-sm text-secondary">
						{poolMeta}
					</Tooltip>
				) : null}
			</BasicLink>
			<DepegWarningIcon deviation={pegDeviation} symbol={pegTokenSymbol} consequence={pegConsequence} />
			{exploited || hasRiskData ? (
				<span className="ml-auto flex shrink-0 items-center gap-2">
					{exploited ? (
						<Tooltip content="This pool involves a protocol or token affected by an exploit or an ongoing incident. Proceed with extreme caution.">
							<Icon name="alert-triangle-filled" height={20} width={20} className="shrink-0 text-data-down" />
						</Tooltip>
					) : null}
					{hasRiskData ? <RiskDataHint configID={configID} poolName={value} /> : null}
				</span>
			) : null}
		</span>
	)
}

// Quiet inline airdrop hint for the earn/borrow/loops/routes surfaces: a small
// glyph sitting inline after the protocol name.
// The tooltip carries the meaning. When the protocol has a known fundraise, the glyph
// becomes 💸 and the tooltip adds its last valuation.
function AirdropHint({ raiseValuationUsd }: { raiseValuationUsd?: number | null | undefined }) {
	return (
		<Tooltip
			content={
				raiseValuationUsd != null ? (
					<span className="flex flex-col gap-1">
						<span className="font-medium">Potential Airdrop</span>
						<span className="border-t border-current/20 pt-1">
							Last Valuation:{' '}
							{formatUsd(raiseValuationUsd, {
								compact: true,
								minimumCompactValue: 1_000_000,
								compactSuffix: 'lowercase'
							})}
						</span>
					</span>
				) : (
					<span className="flex flex-col gap-1">
						<span className="font-medium">Potential Airdrop</span>
						<span>Protocols with no token yet that might airdrop one to depositors in the future</span>
					</span>
				)
			}
			className="shrink-0 body-sm"
		>
			{raiseValuationUsd != null ? '\u{1F4B8}' : '\u{1FA82}'}
		</Tooltip>
	)
}

// Risk-report link, only for pools with vault-risk coverage (never a dead link).
export function RiskDataHint({ configID, poolName }: { configID: string; poolName: string }) {
	const label = `Open ${poolName} risk report`
	return (
		<Tooltip content={label}>
			<BasicLink
				href={`/yields/pool/${configID}/risk`}
				target="_blank"
				rel="noopener noreferrer"
				aria-label={label}
				className="flex items-center text-warning transition-colors hover:text-primary"
			>
				<Icon name="shield-check" height={21} width={21} />
			</BasicLink>
		</Tooltip>
	)
}

export function NameYield({ project, projectslug, airdrop, raiseValuationUsd }: INameYield) {
	const showAirdrop = Boolean(airdrop) && project !== 'Fraxlend'

	const lockup = (
		<>
			<TokenLogo name={project} kind="token" alt={`Logo of ${project}`} size={22} />
			<span className="min-w-0 shrink truncate">{project}</span>
		</>
	)

	return (
		<span className="relative flex items-center gap-2">
			{projectslug ? (
				<BasicLink
					href={`/protocol/${projectslug}`}
					target="_blank"
					rel="noopener noreferrer"
					className="flex min-w-0 shrink items-center gap-2 hover:underline"
				>
					{lockup}
				</BasicLink>
			) : (
				lockup
			)}
			{showAirdrop ? <AirdropHint raiseValuationUsd={raiseValuationUsd} /> : null}
		</span>
	)
}
