import { Bookmark } from '~/components/Bookmark'
import { BasicLink } from '~/components/Link'
import { usePaginatedTableDisplayRowNumber } from '~/components/Table/PaginatedTable'
import { TokenLogo } from '~/components/TokenLogo'
import { formatRaiseAmount } from '~/containers/Raises/utils'
import { Icon } from '~/ui/Icon'
import { Tooltip } from '~/ui/Tooltip'
import { formattedNum } from '~/utils'
import { trackUmamiEvent } from '~/utils/analytics/umami'
import { DepegWarningIcon } from './YieldsCells'

interface INameYield {
	project: string
	projectslug?: string
	airdrop?: boolean
	raiseValuation?: number | null
}

// Quiet external-link glyph (text-tertiary → link on hover) in the leading rail,
// so it sits at a constant x on every row.
function PoolExternalLink({ url, name }: { url: string; name: string }) {
	return (
		<a
			href={url}
			target="_blank"
			rel="noopener noreferrer"
			aria-label="Open external pool"
			onClick={() => trackUmamiEvent('yields-pool-external-link', { pool: name })}
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
	hasRiskData?: boolean
	bookmark?: boolean
	exploited?: boolean
	rowId?: string
	pegDeviation?: number | null
	pegTokenSymbol?: string | null
	pegConsequence?: string
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
	// symbol/detail link and an optional exploit icon hugging the name. The external-link
	// glyph sits centered right after the row number (main's anatomy): constant x on every
	// row, vertically centered by the row's items-center.
	return (
		<span className="flex h-9 min-w-0 items-center gap-2">
			{bookmark ? <Bookmark readableName={value} configID={configID} data-lgonly className="-ml-1" /> : null}
			{rowId != null && rowNumber != null ? (
				<span className="inline-block min-w-4 shrink-0 text-left text-secondary">{rowNumber}</span>
			) : null}
			{url ? <PoolExternalLink url={url} name={value} /> : null}
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
					<Tooltip content={poolMeta} className="max-w-full body-sm text-secondary">
						<span className="truncate">{poolMeta}</span>
					</Tooltip>
				) : null}
			</BasicLink>
			{hasRiskData ? <RiskDataHint configID={configID} className={poolMeta ? 'self-end pb-0.5' : undefined} /> : null}
			<DepegWarningIcon deviation={pegDeviation} symbol={pegTokenSymbol} consequence={pegConsequence} />
			{exploited ? (
				<Tooltip content="This pool involves a protocol or token affected by an exploit. Proceed with extreme caution.">
					<Icon name="alert-triangle" height={14} width={14} className="shrink-0 text-data-down" />
				</Tooltip>
			) : null}
		</span>
	)
}

// Quiet inline airdrop hint for the earn/borrow/loops/routes surfaces: a small
// glyph sitting inline after the protocol name.
// The tooltip carries the meaning. When the protocol has a known fundraise, the glyph
// becomes 💸 and the tooltip adds its last valuation.
function AirdropHint({ raiseValuation }: { raiseValuation?: number | null }) {
	const raiseValuationFormatted = formatRaiseAmount(raiseValuation)
	return (
		<Tooltip
			content={
				raiseValuationFormatted != null ? (
					<span className="flex flex-col gap-1">
						<span className="font-medium">Potential Airdrop</span>
						<span className="border-t border-current/20 pt-1">
							Last Valuation: {formattedNum(raiseValuationFormatted)}
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
			{raiseValuation != null ? '\u{1F4B8}' : '\u{1FA82}'}
		</Tooltip>
	)
}

// Quiet risk-page entry on the meta line: only for pools with confirmed vault-risk
// coverage (per-pool ids from the risk server — never a dead link).
export function RiskDataHint({ configID, className }: { configID: string; className?: string }) {
	return (
		<Tooltip content="View risk data" className={`shrink-0 ${className ?? ''}`}>
			<BasicLink
				href={`/yields/pool/${configID}/risk`}
				target="_blank"
				rel="noopener noreferrer"
				aria-label="View risk data"
				className="flex items-center text-warning transition-colors hover:text-primary"
			>
				<Icon name="shield-check" height={21} width={21} />
			</BasicLink>
		</Tooltip>
	)
}

export function NameYield({ project, projectslug, airdrop, raiseValuation }: INameYield) {
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
			{showAirdrop ? <AirdropHint raiseValuation={raiseValuation} /> : null}
		</span>
	)
}
