import { createColumnHelper } from '@tanstack/react-table'
import * as React from 'react'
import { BasicLink } from '~/components/Link'
import type { SearchTableFeatures } from '~/components/Table/features/search'
import { TokenLogo } from '~/components/TokenLogo'
import { divergingColor } from '~/constants/colors'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { QuestionHelper } from '~/ui/QuestionHelper'
import { Tooltip } from '~/ui/Tooltip'
import { letterLogoDataUri } from '~/utils/icons'
import {
	formatNumber,
	formatPercent,
	formatRatio,
	formatUsd,
	roundNumber,
	USD_LOWERCASE_MILLIONS_OPTIONS
} from '~/utils/numberFormat'
import {
	EuAvailabilityValue,
	getEuStatusPresentation,
	getMicaLicensePresentation,
	KycRequirementValue,
	MicaLicenseValue
} from './ComplianceCells'
import { exchangeDefinitions } from './definitions'
import { feeLabel, FeeValue } from './feePresentation'
import { fiatFeeSummary, FiatFeesValue } from './FiatFeesValue'
import { MiniSparkline } from './MiniSparkline'
import {
	activityForScope,
	byQualityRank,
	depthMetricState,
	depthTotal,
	describeChildLiquidity,
	fractionChange,
	normalizedVolumeForScope,
	sparklineForScope,
	volumeToDepth,
	volumeToOpenInterest
} from './modelHelpers'
import type {
	ExchangeDirectoryRowModel,
	ExchangeNormalizedVolume,
	ExchangeSegment,
	ExchangeSegmentExecution,
	ExchangeVenueKind
} from './models'
import { EXCHANGE_SEGMENT_LABELS } from './models'
import {
	insideShown,
	IntraSpread,
	MarkoutHorizons,
	money,
	FractionChange,
	NA,
	SegmentLines,
	SlippageLadder
} from './ProfileExecution'
import { withCountryParam, type DirectoryScope } from './queryState'
import { selectVenueDestination } from './venueLinks'

const PERCENT_OPTIONS = {
	input: 'fraction',
	minimumFractionDigits: 1,
	maximumFractionDigits: 1,
	useGrouping: false
} as const

const columnHelper = createColumnHelper<SearchTableFeatures, ExchangeDirectoryRowModel>()
export const EXECUTION_COLUMN_IDS = [
	'execCostToTrade',
	'execSlippage10k',
	'spotSlippage',
	'perpSlippage',
	'execMarkout1m',
	'spotMarkout',
	'perpMarkout',
	'intraSpread'
]

function ratio(value: number | null | undefined): string {
	if (value == null) return '–'
	return `${formatRatio(value, { maximumFractionDigits: value >= 100 ? 0 : 1 })}×`
}

function UnsupportedMetric() {
	return <span className="text-tertiary">N/A</span>
}

function KindBadge({ kind }: { kind: ExchangeVenueKind }) {
	return (
		<span className="inline-flex h-[18px] items-center rounded-sm border border-subtle px-1.5 label-sm uppercase">
			{kind}
		</span>
	)
}

// Tier chip — the public summary of the venue's REAL score.
// Fixed bands: S ≥85 (requires measured execution), A ≥70, B ≥55, C ≥40, else D. Each tier takes the value
// scale at its band's place, so tier and score colors agree.
export const TIER_COLORS: Record<string, string> = {
	S: divergingColor(1),
	A: divergingColor(0.5),
	B: divergingColor(0),
	C: divergingColor(-0.5),
	D: divergingColor(-1)
}

// The end tiers are solid (white text passes AA on both), A and C a tint of their color, B an outline, so each tier
// reads at a glance; the scale passes 3:1, not text contrast, so text is never the scale color.
const TIER_SOLID = new Set(['S', 'D'])

export function TierBadge({ tier }: { tier: string }) {
	const color = TIER_COLORS[tier] ?? 'currentColor'
	const solid = TIER_SOLID.has(tier)
	return (
		// Fixed height, not padding: the cell is a fixed-height <td> with overflow:hidden,
		// so a padding-sized badge clips its own top and bottom border.
		<span
			className={`inline-flex h-[18px] min-w-[22px] items-center justify-center rounded-sm border px-1.5 title-sm ${solid ? 'text-on-brand' : 'text-primary'}`}
			style={{
				borderColor: color,
				backgroundColor: solid ? color : tier === 'B' ? undefined : `color-mix(in oklab, ${color} 18%, transparent)`
			}}
		>
			{tier}
		</span>
	)
}

export const RANK_PILLAR_LABELS: Record<string, string> = {
	R: 'Reserves',
	E: 'Execution',
	A: 'Activity',
	L: 'Liquidity'
}

/**
 * R, E, A, L — the pillar keys spell the ranking's name, so every surface that lists
 * them renders in this order. The payload does not promise one.
 */
export const REAL_PILLAR_ORDER = ['R', 'E', 'A', 'L']

export function byRealPillarOrder(a: string, b: string): number {
	// Unknown keys sort last rather than first, where a plain indexOf would put -1.
	return (REAL_PILLAR_ORDER.indexOf(a) + 1 || 99) - (REAL_PILLAR_ORDER.indexOf(b) + 1 || 99)
}

// Pillar weights restated for the hover card only (the profile and the /exchanges/rank
// page read them live from rank-methodology.json). Must match upstream
// lib/rank-components.ts — R, E, A, L.
export const RANK_PILLAR_WEIGHTS: Record<string, number> = { R: 30, E: 30, A: 20, L: 20 }

/** Hover card behind the tier chip: score, in-kind rank, and the pillar breakdown. */
export function QualityHover({
	quality,
	kind
}: {
	quality: NonNullable<ExchangeDirectoryRowModel['quality']>
	kind: string
}) {
	const pillars = Object.entries(quality.components ?? {}).sort(([a], [b]) => byRealPillarOrder(a, b))
	return (
		<div className="flex w-72 flex-col gap-2 py-0.5 text-left">
			<span className="label-sm text-tertiary">REAL score</span>
			<div className="flex items-center gap-2">
				{quality.tier ? <TierBadge tier={quality.tier} /> : null}
				<span className="mono-md-bold">
					{formatNumber(quality.score, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} / 100
				</span>
				<span className="text-tertiary">
					#{quality.rank} of {kind.toUpperCase()}s
				</span>
			</div>
			<div className="flex flex-col gap-1">
				{pillars.map(([key, score]) => {
					const measured = score != null
					return (
						<div key={key} className="flex items-center gap-2">
							<span className="w-28 shrink-0">
								{RANK_PILLAR_LABELS[key] ?? key}
								{RANK_PILLAR_WEIGHTS[key] ? <span className="text-tertiary"> {RANK_PILLAR_WEIGHTS[key]}%</span> : null}
							</span>
							<span className="h-1 flex-1 overflow-hidden rounded-full bg-surface-elevated-2">
								<span
									className="block h-full rounded-full bg-current opacity-70"
									style={{ width: `${measured ? Math.max(2, Math.min(100, score)) : 0}%` }}
								/>
							</span>
							<span className={`w-8 shrink-0 text-right ${measured ? '' : 'text-tertiary'}`}>
								{measured ? Math.round(score) : 'n/a'}
							</span>
						</div>
					)
				})}
			</div>
			<span className="text-tertiary">
				Built only on measured or independently verifiable inputs. n/a never counts as zero; its weight redistributes.
				Tiers: S 85+ (needs measured execution), A 70+, B 55+, C 40+, else D.{' '}
				<BasicLink href="/exchanges/rank" className="text-link hover:underline">
					How the score is built
				</BasicLink>
			</span>
		</div>
	)
}

function linkedMetric(value: React.ReactNode, note: string | undefined) {
	return note ? (
		<Tooltip content={note} className="ms-auto w-fit cursor-help underline decoration-dotted" tabIndex={0}>
			{value}
		</Tooltip>
	) : (
		value
	)
}

function normalizedVolumeNote(nvol: ExchangeNormalizedVolume | null): string | undefined {
	if (!nvol) return undefined
	return `${formatPercent(nvol.discountFraction, PERCENT_OPTIONS) ?? '–'} below ${formatUsd(nvol.reported, USD_LOWERCASE_MILLIONS_OPTIONS) ?? '–'} reported${nvol.flag ? ` · ${nvol.flag}` : ''}`
}

/** The gap to reported for the cell itself. Unsigned: normalized is never above reported,
 *  so "below" is implied; the tooltip spells it out. */
function normalizedVolumeGap(nvol: ExchangeNormalizedVolume | null | undefined): string | undefined {
	if (!nvol || !(nvol.discountFraction > 0)) return undefined // no gap → no annotation
	return formatPercent(nvol.discountFraction, PERCENT_OPTIONS) ?? undefined
}

/** A money value with a muted annotation after it (e.g. the normalized-volume gap). */
function annotatedMetric(value: string, annotation: string | undefined) {
	return annotation ? (
		<>
			{value}
			<span className="ms-1 label-xs text-tertiary">{annotation}</span>
		</>
	) : (
		value
	)
}

/**
 * Normalized volume for a segment, falling back to reported volume when there is no
 * book to normalize against (nvol is dropped entirely for a segment we captured no
 * depth for). A blank cell was hiding real activity, but a reported figure sitting
 * unmarked in a column headed "normalized" is the silent substitution this metric
 * exists to prevent, so the fallback is flagged in the cell and named in the tooltip.
 */
export function normalizedOrReported(
	row: ExchangeDirectoryRowModel,
	segment: ExchangeSegment
): { value: number | null; reported: boolean } {
	const normalized = row.normalizedVolume?.[segment]?.normalized
	if (normalized != null) return { value: normalized, reported: false }
	return { value: row.segments[segment]?.volume24h ?? null, reported: true }
}

const REPORTED_NOTE =
	'Not liquidity-checked: no order book captured for this segment, so there is nothing to normalize against.'

/**
 * One segment-qualified money column for the merged view.
 *
 * A venue that does not run the segment renders N/A, distinct from a venue that runs
 * it and has no observation yet ("–"). In a table mixing spot-only and perp venues
 * that difference is the whole point of the cell.
 */
function segmentColumn(spec: {
	id: string
	segment: ExchangeSegment
	definition: { label: string; description: string }
	value: (row: ExchangeDirectoryRowModel) => number | undefined
	note?: (row: ExchangeDirectoryRowModel) => string | undefined
	/** Marks a value that is not what the header says, e.g. a reported-volume fallback. */
	suffix?: (row: ExchangeDirectoryRowModel) => string
	/** Muted text after the value, e.g. the normalized-volume gap to reported. */
	annotation?: (row: ExchangeDirectoryRowModel) => string | undefined
	/** For labels wider than the default 112px column (see "Column widths" in src/components/Table/README.md). */
	headerClassName?: string
}) {
	return columnHelper.accessor(spec.value, {
		id: spec.id,
		header: spec.definition.label,
		cell: ({ row, getValue }) => {
			if (!row.original.segments[spec.segment]) return <UnsupportedMetric />
			return linkedMetric(
				annotatedMetric(
					`${formatUsd(getValue(), USD_LOWERCASE_MILLIONS_OPTIONS) ?? '–'}${spec.suffix?.(row.original) ?? ''}`,
					spec.annotation?.(row.original)
				),
				spec.note?.(row.original)
			)
		},
		meta: {
			headerClassName: spec.headerClassName ?? 'w-[112px] min-w-[112px]',
			align: 'end',
			headerHelperText: spec.definition.description
		}
	})
}

/** The perpetual class the merged view reports. COIN perps settle differently and are
 *  left to their own segment table rather than folded into a USD-perp column. */
const ALL_PERP_SEGMENTS = ['linear_perp'] as const satisfies ReadonlyArray<ExchangeSegment>

/** Segments normalized volume is computed for. */
const NVOL_SEGMENTS = ['spot', 'linear_perp'] as const satisfies ReadonlyArray<ExchangeSegment>

const fellBackWithBook = (row: ExchangeDirectoryRowModel, segments: ReadonlyArray<ExchangeSegment>) =>
	segments.some(
		(segment) =>
			(NVOL_SEGMENTS as ReadonlyArray<ExchangeSegment>).includes(segment) &&
			row.segments[segment] &&
			normalizedOrReported(row, segment).reported
	)

/**
 * A "USD perp" column in the merged view, kept parameterized over `ALL_PERP_SEGMENTS`
 * so a second class can be folded back in by editing that list alone. With one class
 * it renders exactly like `segmentColumn`, minus the hover breakdown a single segment
 * has nothing to break down.
 */
function perpColumn(spec: {
	id: string
	definition: { label: string; description: string }
	pick: (row: ExchangeDirectoryRowModel, segment: ExchangeSegment) => number | null
	extraNote?: (row: ExchangeDirectoryRowModel) => string | undefined
	/** Marks a value that is not what the header says, e.g. a reported-volume fallback. */
	suffix?: (row: ExchangeDirectoryRowModel) => string
	/** Muted text after the value, e.g. the normalized-volume gap to reported. */
	annotation?: (row: ExchangeDirectoryRowModel) => string | undefined
	/** For labels wider than the default 112px column (see "Column widths" in src/components/Table/README.md). */
	headerClassName?: string
}) {
	const parts = (row: ExchangeDirectoryRowModel) =>
		ALL_PERP_SEGMENTS.filter((segment) => row.segments[segment]).map((segment) => ({
			segment,
			value: spec.pick(row, segment)
		}))
	const total = (row: ExchangeDirectoryRowModel) => {
		const values = parts(row)
			.map((part) => part.value)
			.filter((value): value is number => value != null)
		return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) : undefined
	}
	return columnHelper.accessor(total, {
		id: spec.id,
		header: spec.definition.label,
		cell: ({ row, getValue }) => {
			const present = parts(row.original)
			if (present.length === 0) return <UnsupportedMetric />
			const breakdown = present
				.map(
					({ segment, value }) =>
						`${EXCHANGE_SEGMENT_LABELS[segment]}: ${formatUsd(value, USD_LOWERCASE_MILLIONS_OPTIONS) ?? '–'}`
				)
				.join(' · ')
			return linkedMetric(
				annotatedMetric(
					`${formatUsd(getValue(), USD_LOWERCASE_MILLIONS_OPTIONS) ?? '–'}${spec.suffix?.(row.original) ?? ''}`,
					spec.annotation?.(row.original)
				),
				[breakdown, spec.extraNote?.(row.original)].filter(Boolean).join(' · ')
			)
		},
		meta: {
			headerClassName: spec.headerClassName ?? 'w-[112px] min-w-[112px]',
			align: 'end',
			headerHelperText: spec.definition.description
		}
	})
}

/**
 * Every execution column reads one segment of the venue (row.executionBySegment): its own
 * measured markets there, each token's markets merged by volume, tokens weighted the same
 * way for every venue, so a column compares like for like down the table.
 */
const EXECUTION_SCOPE_NOTE = 'Last 30 days of the venue’s measured markets in this segment.'

/** The segments the merged view shows execution for, in reading order. */
const MERGED_EXEC_SEGMENTS = ['spot', 'linear_perp'] as const satisfies ReadonlyArray<ExchangeSegment>

/** One line per segment the venue runs, labeled; N/A when it runs none of them. */
function segmentLines(
	row: ExchangeDirectoryRowModel,
	value: (segment: ExchangeSegment) => React.ReactNode,
	segments: ReadonlyArray<ExchangeSegment> = MERGED_EXEC_SEGMENTS
) {
	return <SegmentLines present={segments.filter((segment) => row.segments[segment])} value={value} />
}

const segmentExec = (row: ExchangeDirectoryRowModel, segment: ExchangeSegment) =>
	row.executionBySegment[segment] ?? null

export function buildDirectoryColumns(scope: DirectoryScope, executionAvailable: boolean) {
	const definitions = exchangeDefinitions.directory
	// Every exact-segment column reads through these. The merged `all` view has no
	// single segment to read, so they resolve to nothing rather than silently picking
	// one: those columns are hidden there, and an empty CSV cell beats a cell whose
	// header never says which segment it came from.
	const scopedActivity = (row: ExchangeDirectoryRowModel) => (scope === 'all' ? null : activityForScope(row, scope))
	const scopedNvol = (row: ExchangeDirectoryRowModel) => (scope === 'all' ? null : normalizedVolumeForScope(row, scope))
	const scopedSpark = (row: ExchangeDirectoryRowModel) => (scope === 'all' ? [] : sparklineForScope(row, scope))
	const scopedExec = (row: ExchangeDirectoryRowModel): ExchangeSegmentExecution | null =>
		scope === 'all' ? null : (row.executionBySegment[scope] ?? null)
	// the merged view sorts by USD perp, spot where the venue has no perps
	const costOf = (row: ExchangeDirectoryRowModel) =>
		scope === 'all'
			? (segmentExec(row, 'linear_perp')?.costToTradeBps ?? segmentExec(row, 'spot')?.costToTradeBps ?? null)
			: (scopedExec(row)?.costToTradeBps ?? null)
	// A merged-view slippage or markout column: one segment, with the two rungs stacked.
	const mergedExecColumn = (spec: {
		id: string
		segment: ExchangeSegment
		definition: { label: string; description: string }
		field: 'realizedSlippage10kBps' | 'markout1mBps'
		width: string
	}) =>
		columnHelper.accessor((row) => segmentExec(row, spec.segment)?.[spec.field] ?? undefined, {
			id: spec.id,
			header: spec.definition.label,
			sortDescFirst: false,
			cell: ({ row }) => {
				if (!row.original.segments[spec.segment]) return <UnsupportedMetric />
				const execution = segmentExec(row.original, spec.segment)
				return spec.field === 'markout1mBps' ? (
					<MarkoutHorizons execution={execution} />
				) : (
					<SlippageLadder execution={execution} />
				)
			},
			meta: {
				headerClassName: spec.width,
				align: 'end',
				headerHelperText: `${spec.definition.description} ${EXECUTION_SCOPE_NOTE}`,
				csvValue: (row) => {
					const value = segmentExec(row, spec.segment)?.[spec.field]
					return value == null ? '' : String(roundNumber(value, 2))
				}
			}
		})
	const columns = columnHelper.columns([
		columnHelper.accessor((row) => `${row.name} ${row.slug} ${row.profile?.nativeToken ?? ''}`, {
			id: 'name',
			enableHiding: false,
			header: definitions.name.label,
			// Sorts on the ranking the rows arrive in, not the name: it is the only way back
			// to the default order once a reader has sorted by some other column.
			sortDescFirst: false,
			sortFn: (a, b) => byQualityRank(a.original, b.original),
			cell: ({ row }) => {
				const venue = row.original
				const profileHref = withCountryParam(venue.profileHref, venue.selectedCountry)
				const liquidityNote = row.depth > 0 ? describeChildLiquidity(venue) : null
				// Every row wears its own chip: the brand row its family's best rank,
				// each child venue its own sub-rank underneath.
				const quality = venue.quality
				return (
					<div className={`relative flex min-w-0 items-center gap-2 ${row.depth > 0 ? 'pl-12' : 'pl-6'}`}>
						{row.subRows.length > 0 ? (
							<Button
								size="sm"
								variant="ghost"
								square
								aria-expanded={row.getIsExpanded()}
								type="button"
								className="absolute -left-1.5"
								onClick={row.getToggleExpandedHandler()}
							>
								{row.getIsExpanded() ? (
									<>
										<Icon name="chevron-down" className="size-4 text-tertiary" />
										<span className="sr-only">Hide child venues</span>
									</>
								) : (
									<>
										<Icon name="chevron-right" className="size-4 text-tertiary" />
										<span className="sr-only">Show child venues</span>
									</>
								)}
							</Button>
						) : null}
						{/* min-w-2ch holds 1-99, so the 9 -> 10 jump stops shifting the badge, logo and
						    name right. Scoped here rather than on the shared vf-row-index utility, which
						    every other table also uses. */}
						<span className="vf-row-index min-w-[2ch] shrink-0" aria-hidden="true" />
						{/* Fixed slot: untiered rows keep the badge's width so every logo and name lines up. */}
						<span className="flex w-[22px] shrink-0 justify-center">
							{quality?.tier ? (
								// data-fullwidth lifts the tooltip surface's max-w-56 cap; the hover
								// card is a ~280px layout, not wrapping prose, and clips without it.
								<Tooltip
									content={<QualityHover quality={quality} kind={venue.kind} />}
									className="shrink-0"
									data-fullwidth
								>
									<TierBadge tier={quality.tier} />
								</Tooltip>
							) : null}
						</span>
						<TokenLogo
							name={venue.slug}
							kind="exchange"
							size={24}
							fallbackSrc={letterLogoDataUri(venue.name)}
							alt={`${venue.name} logo`}
						/>
						<div className="flex min-w-0 flex-1 flex-col gap-0.5">
							<div className="flex min-w-0 items-center gap-2">
								<BasicLink href={profileHref} className="truncate label-md text-link hover:underline">
									{venue.name}
								</BasicLink>
								{liquidityNote ? <QuestionHelper text={liquidityNote} /> : null}
							</div>
							{venue.tracked ? null : <span className="body-sm text-tertiary">Metadata only</span>}
						</div>
					</div>
				)
			},
			meta: {
				headerClassName: 'w-[254px] min-w-[254px]',
				headerHelperText: definitions.name.description,
				csvValue: (row) => row.name
			}
		}),
		// Lives outside the sticky name column so the venue name is not squeezed by up to
		// three shrink-0 buttons, which cost the name ~50px on a mobile viewport.
		columnHelper.display({
			id: 'venueLinks',
			header: definitions.venueLinks.label,
			enableSorting: false,
			cell: ({ row }) => {
				const venue = row.original
				const reservesHref = venue.reservesHref ? withCountryParam(venue.reservesHref, venue.selectedCountry) : null
				const defillamaPath = venue.secondaryUrl
				const venueDestination = selectVenueDestination(venue.slug, venue.referralUrl, venue.websiteUrl)
				return (
					<div className="flex items-center gap-0.5">
						{reservesHref ? (
							<Tooltip
								content="Open reserves"
								render={
									<Button
										as={BasicLink}
										variant="ghost"
										size="sm"
										square
										href={reservesHref}
										aria-label={`Open ${venue.name} reserves`}
									/>
								}
							>
								<Icon name="wallet" className="size-4" />
							</Tooltip>
						) : null}
						{defillamaPath ? (
							<Tooltip
								content={`Open ${venue.kind.toUpperCase()} profile`}
								render={
									<Button
										as={BasicLink}
										variant="ghost"
										size="sm"
										square
										href={defillamaPath}
										aria-label={`Open ${venue.name} ${venue.kind.toUpperCase()} profile`}
									/>
								}
							>
								<Icon name="bar-chart-2" className="size-4" />
							</Tooltip>
						) : null}
						{venueDestination ? (
							<Tooltip
								content="Open venue website"
								render={
									<Button
										as={BasicLink}
										variant="ghost"
										size="sm"
										square
										href={venueDestination.url}
										target="_blank"
										rel="noopener noreferrer"
										aria-label={`Open ${venue.name} website`}
										data-umami-event="exchange-website-click"
										data-umami-event-exchange={venue.name}
										data-umami-event-referral={venueDestination.kind === 'referral' ? 'true' : 'false'}
										data-umami-event-url={venueDestination.url}
									/>
								}
							>
								<Icon name="globe" className="size-4" />
							</Tooltip>
						) : null}
					</div>
				)
			},
			meta: {
				headerClassName: 'w-[100px] min-w-[100px]',
				headerHelperText: definitions.venueLinks.description
			}
		}),
		// Measured execution quality from tick-level fills, per segment (row.executionBySegment).
		// 1bp of $10k = $1, so bps figures ARE dollars per $10k trade.
		columnHelper.accessor((row) => costOf(row) ?? undefined, {
			id: 'execCostToTrade',
			header: definitions.execCostToTrade.label,
			sortDescFirst: false,
			cell: ({ row, getValue }) => {
				if (scope === 'all') {
					// Spot and USD perp on one line each; sorted by USD perp, spot where there is none.
					return segmentLines(row.original, (segment) => {
						const cost = segmentExec(row.original, segment)?.costToTradeBps
						return cost == null ? NA : money(cost)
					})
				}
				const cost = getValue()
				if (cost == null) return NA
				const execution = scopedExec(row.original)
				// One number. Showing the effective spread beside it read as a breakdown, but
				// the all-in figure carries HALF the spread, so the two never added up to
				// anything and invited arithmetic that does not hold. The split belongs in the
				// tooltip, where it can say so.
				return (
					<Tooltip
						content={`Taker fee plus half the ${formatUsd(execution?.effectiveSpreadBps ?? null, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? 'n/a'} effective spread, from ${execution?.hoursCovered ?? 'n/a'}h of fills.`}
						className="ms-auto w-fit cursor-help"
						tabIndex={0}
					>
						<span className="underline decoration-dotted">
							{formatUsd(cost, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? 'n/a'}
						</span>
					</Tooltip>
				)
			},
			meta: {
				headerClassName: 'w-[160px] min-w-[160px]',
				align: 'end',
				headerHelperText: `${definitions.execCostToTrade.description} ${EXECUTION_SCOPE_NOTE}${scope === 'all' ? ' One line per segment, sorted by USD perp.' : ''}`,
				csvValue: (row) => {
					const cost = costOf(row)
					return cost == null ? '' : String(roundNumber(cost, 2))
				}
			}
		}),
		columnHelper.accessor((row) => scopedExec(row)?.realizedSlippage10kBps ?? undefined, {
			id: 'execSlippage10k',
			header: definitions.execSlippage10k.label,
			sortDescFirst: false,
			cell: ({ row }) => <SlippageLadder execution={scopedExec(row.original)} />,
			meta: {
				headerClassName: 'w-[186px] min-w-[186px]',
				align: 'end',
				headerHelperText: `${definitions.execSlippage10k.description} ${EXECUTION_SCOPE_NOTE}`,
				csvValue: (row) => {
					const value = scopedExec(row)?.realizedSlippage10kBps
					return value == null ? '' : String(roundNumber(value, 2))
				}
			}
		}),
		mergedExecColumn({
			id: 'spotSlippage',
			segment: 'spot',
			definition: definitions.spotSlippage,
			field: 'realizedSlippage10kBps',
			width: 'w-[204px] min-w-[204px]'
		}),
		mergedExecColumn({
			id: 'perpSlippage',
			segment: 'linear_perp',
			definition: definitions.perpSlippage,
			field: 'realizedSlippage10kBps',
			width: 'w-[204px] min-w-[204px]'
		}),
		columnHelper.accessor((row) => scopedExec(row)?.markout1mBps ?? undefined, {
			id: 'execMarkout1m',
			header: definitions.execMarkout1m.label,
			sortDescFirst: false,
			cell: ({ row }) => <MarkoutHorizons execution={scopedExec(row.original)} />,
			meta: {
				headerClassName: 'w-[140px] min-w-[140px]',
				align: 'end',
				headerHelperText: `${definitions.execMarkout1m.description} ${EXECUTION_SCOPE_NOTE}`,
				csvValue: (row) => {
					const value = scopedExec(row)?.markout1mBps
					return value == null ? '' : String(roundNumber(value, 2))
				}
			}
		}),
		mergedExecColumn({
			id: 'spotMarkout',
			segment: 'spot',
			definition: definitions.spotMarkout,
			field: 'markout1mBps',
			width: 'w-[140px] min-w-[140px]'
		}),
		mergedExecColumn({
			id: 'perpMarkout',
			segment: 'linear_perp',
			definition: definitions.perpMarkout,
			field: 'markout1mBps',
			width: 'w-[150px] min-w-[150px]'
		}),
		// Blank below INSIDE_MIN_PCT, a false flag there; the merged view lists only the
		// segments that reach it.
		columnHelper.accessor(
			(row) => {
				if (scope !== 'all') return insideShown(scopedExec(row)?.insideSpreadPct) ?? undefined
				const shown = MERGED_EXEC_SEGMENTS.map((segment) =>
					insideShown(segmentExec(row, segment)?.insideSpreadPct)
				).filter((value): value is number => value != null)
				return shown.length > 0 ? Math.max(...shown) : undefined
			},
			{
				id: 'intraSpread',
				header: definitions.intraSpread.label,
				sortDescFirst: true,
				cell: ({ row }) => {
					if (scope !== 'all') return <IntraSpread pct={scopedExec(row.original)?.insideSpreadPct} />
					const flagged = MERGED_EXEC_SEGMENTS.filter(
						(segment) =>
							row.original.segments[segment] && insideShown(segmentExec(row.original, segment)?.insideSpreadPct) != null
					)
					if (flagged.length === 0) return null
					return segmentLines(
						row.original,
						(segment) => <IntraSpread pct={segmentExec(row.original, segment)?.insideSpreadPct} />,
						flagged
					)
				},
				meta: {
					headerClassName: 'w-[150px] min-w-[150px]',
					align: 'end',
					headerHelperText: `${definitions.intraSpread.description} ${EXECUTION_SCOPE_NOTE}`
				}
			}
		),
		// ── merged `all` view ────────────────────────────────────────────────────
		// Segment-qualified twins of the scoped columns above. They exist so one row can
		// carry spot and USD perps at once; each names its segment in the header, because
		// the whole failure mode of a merged table is a number whose market is unstated.
		// Hidden outside the `all` scope, where the scoped versions serve instead.
		columnHelper.accessor(
			(row) => {
				const values = NVOL_SEGMENTS.map((segment) => row.normalizedVolume?.[segment]?.activeLiquidity).filter(
					(value): value is number => value != null
				)
				return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) : undefined
			},
			{
				id: 'segmentActiveLiquidity',
				header: definitions.segmentActiveLiquidity.label,
				cell: ({ row }) =>
					segmentLines(
						row.original,
						(segment) =>
							formatUsd(
								row.original.normalizedVolume?.[segment]?.activeLiquidity ?? null,
								USD_LOWERCASE_MILLIONS_OPTIONS
							) ?? '–',
						NVOL_SEGMENTS
					),
				meta: {
					headerClassName: 'w-[180px] min-w-[180px]',
					align: 'end',
					headerHelperText: `${definitions.segmentActiveLiquidity.description} Sorted by the two together.`
				}
			}
		),
		perpColumn({
			id: 'perpOpenInterest',
			definition: definitions.perpOpenInterest,
			pick: (row, segment) => row.segments[segment]?.openInterestUsd ?? null,
			extraNote: (row) => row.segments.linear_perp?.doubleCount?.openInterest
		}),
		segmentColumn({
			id: 'spotNormalizedVolume',
			segment: 'spot',
			definition: definitions.spotNormalizedVolume,
			value: (row) => normalizedOrReported(row, 'spot').value ?? undefined,
			suffix: (row) => (fellBackWithBook(row, ['spot']) ? '*' : ''),
			annotation: (row) =>
				normalizedOrReported(row, 'spot').reported ? undefined : normalizedVolumeGap(row.normalizedVolume?.spot),
			note: (row) =>
				normalizedOrReported(row, 'spot').reported
					? REPORTED_NOTE
					: normalizedVolumeNote(row.normalizedVolume?.spot ?? null)
		}),
		perpColumn({
			id: 'perpNormalizedVolume',
			definition: definitions.perpNormalizedVolume,
			pick: (row, segment) => normalizedOrReported(row, segment).value,
			headerClassName: 'w-[128px] min-w-[128px]',
			suffix: (row) => (fellBackWithBook(row, ALL_PERP_SEGMENTS) ? '*' : ''),
			annotation: (row) =>
				fellBackWithBook(row, ALL_PERP_SEGMENTS) ? undefined : normalizedVolumeGap(row.normalizedVolume?.linear_perp),
			extraNote: (row) =>
				fellBackWithBook(row, ALL_PERP_SEGMENTS)
					? REPORTED_NOTE
					: normalizedVolumeNote(row.normalizedVolume?.linear_perp ?? null)
		}),
		// Active liquidity leads the activity view: it is the liquidity fact volume is
		// judged against, and unlike the fixed ±2% column its band tracks how far the
		// day's price actually moves — on a market ranging 10% a day, the depth that
		// matters is nowhere near ±2%.
		columnHelper.accessor((row) => scopedNvol(row)?.activeLiquidity ?? undefined, {
			id: 'activeLiquidity',
			header: definitions.activeLiquidity.label,
			cell: ({ row, getValue }) => {
				const nvol = scopedNvol(row.original)
				if (!nvol) return <span className="text-tertiary">–</span>
				const fixedDepth = depthTotal(scopedActivity(row.original))
				// Observed depth only. Where the band ran past what our snapshot captured,
				// this is the whole captured book rather than a projection of it — a
				// displayed liquidity figure has to be liquidity that exists.
				const notes = [
					fixedDepth != null
						? `Fixed ±2% depth: ${formatUsd(fixedDepth, USD_LOWERCASE_MILLIONS_OPTIONS) ?? '–'}`
						: null,
					scopedActivity(row.original)?.doubleCount?.depth
				].filter(Boolean)
				return linkedMetric(formatUsd(getValue(), USD_LOWERCASE_MILLIONS_OPTIONS) ?? '–', notes.join(' · '))
			},
			meta: {
				headerClassName: 'w-[124px] min-w-[124px]',
				align: 'end',
				headerHelperText: definitions.activeLiquidity.description
			}
		}),
		columnHelper.accessor((row) => depthTotal(scopedActivity(row)) ?? undefined, {
			id: 'depth2Usd',
			header: definitions.depth2Usd.label,
			cell: ({ row, getValue }) => {
				const activity = scopedActivity(row.original)
				const metric = depthMetricState(activity)
				if (metric.state === 'unsupported') return <UnsupportedMetric />
				if (metric.state === 'missing') return <span className="text-tertiary">–</span>
				const note = [metric.partial ? 'Partial orderbook coverage' : null, activity?.doubleCount?.depth]
					.filter(Boolean)
					.join(' · ')
				return linkedMetric(formatUsd(getValue(), USD_LOWERCASE_MILLIONS_OPTIONS) ?? '–', note || undefined)
			},
			meta: {
				headerClassName: 'w-[114px] min-w-[114px]',
				align: 'end',
				headerHelperText: definitions.depth2Usd.description
			}
		}),
		// Scoped tables read execution quality, then liquidity, then the open interest that
		// liquidity backs, then volume: reported, normalized, and only then the delta. Spot
		// has no open interest, so that scope hides these two (SCOPE_HIDDEN_COLUMN_IDS).
		columnHelper.accessor((row) => scopedActivity(row)?.openInterestUsd ?? undefined, {
			id: 'openInterestUsd',
			header: definitions.openInterestUsd.label,
			cell: ({ row, getValue }) => {
				const activity = scopedActivity(row.original)
				if (!activity?.supportsOpenInterest) return <UnsupportedMetric />
				return linkedMetric(
					formatUsd(getValue(), USD_LOWERCASE_MILLIONS_OPTIONS) ?? '–',
					activity.doubleCount?.openInterest
				)
			},
			meta: {
				headerClassName: 'w-[129px] min-w-[129px]',
				align: 'end',
				headerHelperText: definitions.openInterestUsd.description
			}
		}),
		columnHelper.accessor(
			(row) => {
				const activity = scopedActivity(row)
				return fractionChange(activity?.openInterestUsd, activity?.openInterestPreviousUsd) ?? undefined
			},
			{
				id: 'openInterestChange24h',
				header: definitions.openInterestChange24h.label,
				cell: ({ row, getValue }) => {
					if (!scopedActivity(row.original)?.supportsOpenInterest) return <UnsupportedMetric />
					return <FractionChange value={getValue()} />
				},
				meta: {
					headerClassName: 'w-[89px] min-w-[89px]',
					align: 'end',
					headerHelperText: definitions.openInterestChange24h.description
				}
			}
		),
		columnHelper.accessor((row) => scopedActivity(row)?.volume24h ?? undefined, {
			id: 'volume24h',
			header: definitions.volume24h.label,
			cell: ({ row, getValue }) =>
				linkedMetric(
					formatUsd(getValue(), USD_LOWERCASE_MILLIONS_OPTIONS) ?? '–',
					scopedActivity(row.original)?.doubleCount?.volume
				),
			meta: {
				headerClassName: 'w-[124px] min-w-[124px]',
				align: 'end',
				headerHelperText: definitions.volume24h.description
			}
		}),
		columnHelper.accessor((row) => scopedNvol(row)?.normalized ?? undefined, {
			id: 'normalizedVolume',
			header: definitions.normalizedVolume.label,
			cell: ({ row, getValue }) => {
				const nvol = scopedNvol(row.original)
				return nvol ? (
					<Tooltip
						content={`${formatPercent(nvol.discountFraction, PERCENT_OPTIONS) ?? '–'} below reported · ${formatPercent(nvol.unverifiedFraction, PERCENT_OPTIONS) ?? '–'} judged against estimated depth${nvol.flag ? ` · ${nvol.flag}` : ''}`}
						className="ms-auto w-fit cursor-help"
						tabIndex={0}
					>
						<span className="underline decoration-dotted">
							{formatUsd(getValue(), USD_LOWERCASE_MILLIONS_OPTIONS) ?? '–'}
						</span>
						{annotatedMetric('', normalizedVolumeGap(nvol))}
					</Tooltip>
				) : (
					'–'
				)
			},
			meta: {
				headerClassName: 'w-[130px] min-w-[130px]',
				align: 'end',
				headerHelperText: definitions.normalizedVolume.description
			}
		}),
		columnHelper.accessor(
			(row) => {
				const activity = scopedActivity(row)
				return fractionChange(activity?.volume24h, activity?.volumePrevious24h) ?? undefined
			},
			{
				id: 'volumeChange24h',
				header: definitions.volumeChange24h.label,
				cell: ({ getValue }) => <FractionChange value={getValue()} />,
				meta: {
					headerClassName: 'w-[102px] min-w-[102px]',
					align: 'end',
					headerHelperText: definitions.volumeChange24h.description
				}
			}
		),
		columnHelper.accessor((row) => volumeToOpenInterest(scopedActivity(row)) ?? undefined, {
			id: 'volumeToOi',
			header: definitions.volumeToOi.label,
			cell: ({ row, getValue }) =>
				scopedActivity(row.original)?.supportsOpenInterest ? ratio(getValue()) : <UnsupportedMetric />,
			meta: {
				headerClassName: 'w-[96px] min-w-[96px]',
				align: 'end',
				headerHelperText: definitions.volumeToOi.description
			}
		}),
		columnHelper.accessor((row) => volumeToDepth(scopedActivity(row)) ?? undefined, {
			id: 'volumeToDepth',
			header: definitions.volumeToDepth.label,
			cell: ({ row, getValue }) =>
				scopedActivity(row.original)?.supportsDepth ? ratio(getValue()) : <UnsupportedMetric />,
			meta: {
				headerClassName: 'w-[110px] min-w-[110px]',
				align: 'end',
				headerHelperText: definitions.volumeToDepth.description
			}
		}),
		columnHelper.accessor((row) => scopedActivity(row)?.marketCount ?? undefined, {
			id: 'marketCount',
			header: definitions.marketCount.label,
			cell: ({ getValue }) => getValue() ?? '–',
			meta: {
				headerClassName: 'w-[93px] min-w-[93px]',
				align: 'end',
				headerHelperText: definitions.marketCount.description
			}
		}),
		columnHelper.accessor((row) => scopedActivity(row)?.coinCount ?? undefined, {
			id: 'coinCount',
			header: definitions.coinCount.label,
			cell: ({ getValue }) => getValue() ?? '–',
			meta: {
				headerClassName: 'w-[79px] min-w-[79px]',
				align: 'end',
				headerHelperText: definitions.coinCount.description
			}
		}),
		columnHelper.accessor((row) => scopedSpark(row), {
			id: 'sparkline',
			header: definitions.sparkline.label,
			enableSorting: false,
			cell: ({ row, getValue }) => (
				<MiniSparkline
					values={getValue()}
					label={`${row.original.name} ${EXCHANGE_SEGMENT_LABELS[scope]} volume trend`}
				/>
			),
			meta: {
				headerClassName: 'w-[124px] min-w-[124px]',
				align: 'end',
				headerHelperText: definitions.sparkline.description
			}
		}),
		columnHelper.accessor((row) => row.reserves?.totalUsd ?? undefined, {
			id: 'reservesUsd',
			header: definitions.reservesUsd.label,
			cell: ({ getValue }) => formatUsd(getValue(), USD_LOWERCASE_MILLIONS_OPTIONS) ?? '–',
			meta: {
				headerClassName: 'w-[119px] min-w-[119px]',
				align: 'end',
				headerHelperText: definitions.reservesUsd.description
			}
		}),
		columnHelper.accessor(
			(row) =>
				row.reserves?.cleanUsd != null && row.reserves.totalUsd != null && row.reserves.totalUsd > 0
					? row.reserves.cleanUsd / row.reserves.totalUsd
					: undefined,
			{
				id: 'cleanRatio',
				header: definitions.cleanRatio.label,
				cell: ({ getValue }) => formatPercent(getValue(), PERCENT_OPTIONS) ?? '–',
				meta: {
					headerClassName: 'w-[114px] min-w-[114px]',
					align: 'end',
					headerHelperText: definitions.cleanRatio.description
				}
			}
		),
		columnHelper.accessor((row) => row.reserves?.inflows24hUsd ?? undefined, {
			id: 'inflows24hUsd',
			header: definitions.inflows24hUsd.label,
			cell: ({ getValue }) => formatUsd(getValue(), USD_LOWERCASE_MILLIONS_OPTIONS) ?? '–',
			meta: {
				headerClassName: 'w-[117px] min-w-[117px]',
				align: 'end',
				headerHelperText: definitions.inflows24hUsd.description
			}
		}),
		columnHelper.accessor((row) => row.reserves?.inflows7dUsd ?? undefined, {
			id: 'inflows7dUsd',
			header: definitions.inflows7dUsd.label,
			cell: ({ getValue }) => formatUsd(getValue(), USD_LOWERCASE_MILLIONS_OPTIONS) ?? '–',
			meta: {
				headerClassName: 'w-[114px] min-w-[114px]',
				align: 'end',
				headerHelperText: definitions.inflows7dUsd.description
			}
		}),
		columnHelper.accessor((row) => row.reserves?.inflows1mUsd ?? undefined, {
			id: 'inflows1mUsd',
			header: definitions.inflows1mUsd.label,
			cell: ({ getValue }) => formatUsd(getValue(), USD_LOWERCASE_MILLIONS_OPTIONS) ?? '–',
			meta: {
				headerClassName: 'w-[114px] min-w-[114px]',
				align: 'end',
				headerHelperText: definitions.inflows1mUsd.description
			}
		}),
		columnHelper.accessor((row) => row.reserves?.ownTokenFraction ?? undefined, {
			id: 'ownTokenFraction',
			header: definitions.ownTokenFraction.label,
			cell: ({ getValue }) => formatPercent(getValue(), PERCENT_OPTIONS) ?? '–',
			meta: {
				headerClassName: 'w-[114px] min-w-[114px]',
				align: 'end',
				headerHelperText: definitions.ownTokenFraction.description
			}
		}),
		columnHelper.accessor((row) => row.reserves?.auditor, {
			id: 'auditor',
			header: definitions.auditor.label,
			cell: ({ getValue }) => getValue() ?? '–',
			meta: {
				headerClassName: 'w-[119px] min-w-[119px]',
				headerHelperText: definitions.auditor.description
			}
		}),
		columnHelper.accessor((row) => scopedActivity(row)?.volumeUpdatedAt, {
			id: 'freshness',
			header: definitions.freshness.label,
			cell: ({ getValue }) => getValue()?.slice(0, 10) ?? '–',
			meta: {
				headerClassName: 'w-[114px] min-w-[114px]',
				align: 'end',
				headerHelperText: definitions.freshness.description
			}
		}),
		columnHelper.accessor((row) => row.warnings.length, {
			id: 'warnings',
			header: definitions.warnings.label,
			cell: ({ row, getValue }) =>
				getValue() > 0 ? (
					<Tooltip
						className="cursor-help underline decoration-dotted"
						content={row.original.warnings.map((warning) => warning.text).join(' · ')}
						tabIndex={0}
					>
						{getValue()}
					</Tooltip>
				) : (
					'–'
				),
			meta: {
				headerClassName: 'w-[102px] min-w-[102px]',
				align: 'end',
				headerHelperText: definitions.warnings.description
			}
		}),
		columnHelper.accessor((row) => row.reserves?.sourceUrl, {
			id: 'reservesSource',
			header: definitions.reservesSource.label,
			enableSorting: false,
			cell: ({ getValue }) => {
				const sourceUrl = getValue()
				return sourceUrl ? (
					<BasicLink href={sourceUrl} target="_blank" rel="noopener noreferrer" className="text-link hover:underline">
						Verify
					</BasicLink>
				) : (
					'–'
				)
			},
			meta: {
				headerClassName: 'w-[79px] min-w-[79px]',
				headerHelperText: definitions.reservesSource.description
			}
		}),
		columnHelper.display({
			id: 'spotFee',
			header: definitions.spotFee.label,
			cell: ({ row }) => <FeeValue fee={row.original.fees?.spot} kind="spot" />,
			meta: {
				headerClassName: 'w-[129px] min-w-[129px] whitespace-nowrap',
				align: 'end',
				headerHelperText: definitions.spotFee.description,
				csvValue: (row) => (row.fees?.spot ? feeLabel(row.fees.spot) : '–')
			}
		}),
		columnHelper.display({
			id: 'linearPerpFee',
			header: definitions.linearPerpFee.label,
			cell: ({ row }) => <FeeValue fee={row.original.fees?.linearPerp} kind="perp" />,
			meta: {
				headerClassName: 'w-[139px] min-w-[139px] whitespace-nowrap',
				align: 'end',
				headerHelperText: definitions.linearPerpFee.description,
				csvValue: (row) => (row.fees?.linearPerp ? feeLabel(row.fees.linearPerp) : '–')
			}
		}),
		columnHelper.display({
			id: 'inversePerpFee',
			header: definitions.inversePerpFee.label,
			cell: ({ row }) => <FeeValue fee={row.original.fees?.inversePerp} kind="perp" />,
			meta: {
				headerClassName: 'w-[139px] min-w-[139px] whitespace-nowrap',
				align: 'end',
				headerHelperText: definitions.inversePerpFee.description,
				csvValue: (row) => (row.fees?.inversePerp ? feeLabel(row.fees.inversePerp) : '–')
			}
		}),
		columnHelper.accessor((row) => row.fees?.feeToken?.symbol, {
			id: 'feeToken',
			header: definitions.feeToken.label,
			cell: ({ row, getValue }) => {
				const symbol = getValue()
				const discount = row.original.fees?.feeToken?.discountFraction
				return symbol
					? `${symbol.toUpperCase()}${discount == null ? '' : ` · ${formatPercent(discount, PERCENT_OPTIONS) ?? '–'} off`}`
					: '–'
			},
			meta: { headerClassName: 'w-[130px] min-w-[130px]', headerHelperText: definitions.feeToken.description }
		}),
		columnHelper.accessor((row) => row.funding?.fiatCurrencies?.join(', '), {
			id: 'fiatCurrencies',
			header: definitions.fiatCurrencies.label,
			enableSorting: false,
			cell: ({ getValue }) => getValue() ?? '–',
			meta: { headerClassName: 'w-[193px] min-w-[193px]', headerHelperText: definitions.fiatCurrencies.description }
		}),
		columnHelper.display({
			id: 'fiatFees',
			header: definitions.fiatFees.label,
			cell: ({ row }) => <FiatFeesValue name={row.original.name} fees={row.original.funding?.fiatFees ?? null} />,
			meta: {
				headerClassName: 'w-[114px] min-w-[114px]',
				headerHelperText: definitions.fiatFees.description,
				csvValue: (row) => (row.funding?.fiatFees ? fiatFeeSummary(row.funding.fiatFees) : '–')
			}
		}),
		columnHelper.accessor((row) => row.funding?.hasFiatOnramp, {
			id: 'fiatOnramp',
			header: definitions.fiatOnramp.label,
			cell: ({ getValue }) => (getValue() == null ? '–' : getValue() ? 'Yes' : 'No'),
			meta: { headerClassName: 'w-[124px] min-w-[124px]', headerHelperText: definitions.fiatOnramp.description }
		}),
		// Region figure wins when a country is selected — it is priced off that
		// region's own rails (US ACH, GB Faster Payments…) rather than the root
		// block's EUR/SEPA path, which several venues do not even have.
		columnHelper.accessor(
			(row) => row.funding?.rampCostRegion?.onRampUsd ?? row.funding?.rampCost?.onRamp.totalUsd ?? undefined,
			{
				id: 'rampCost',
				header: definitions.rampCost.label,
				cell: ({ getValue }) => formatUsd(getValue(), USD_LOWERCASE_MILLIONS_OPTIONS) ?? '–',
				meta: {
					headerClassName: 'w-[155px] min-w-[155px]',
					align: 'end',
					headerHelperText: definitions.rampCost.description
				}
			}
		),
		columnHelper.accessor(
			(row) => row.funding?.rampCostRegion?.offRampUsd ?? row.funding?.rampCost?.offRamp.totalUsd ?? undefined,
			{
				id: 'offRampCost',
				header: definitions.offRampCost.label,
				cell: ({ getValue }) => formatUsd(getValue(), USD_LOWERCASE_MILLIONS_OPTIONS) ?? '–',
				meta: {
					headerClassName: 'w-[155px] min-w-[155px]',
					align: 'end',
					headerHelperText: definitions.offRampCost.description
				}
			}
		),
		columnHelper.accessor((row) => row.compliance?.headquarters, {
			id: 'headquarters',
			header: definitions.headquarters.label,
			cell: ({ getValue }) => {
				const headquarters = getValue()
				return headquarters ? (
					<Tooltip content={headquarters} render={<span className="block truncate" />}>
						{headquarters}
					</Tooltip>
				) : (
					<span className="text-tertiary">–</span>
				)
			},
			meta: {
				headerClassName: 'w-[199px] min-w-[199px]',
				headerHelperText: definitions.headquarters.description
			}
		}),
		columnHelper.accessor((row) => row.compliance?.euStatus, {
			id: 'euStatus',
			header: definitions.euStatus.label,
			cell: ({ row }) => (
				<EuAvailabilityValue
					status={row.original.compliance?.euStatus ?? null}
					eeaOrderbookOwnership={row.original.compliance?.eeaOrderbookOwnership ?? null}
				/>
			),
			meta: {
				headerClassName: 'w-[144px] min-w-[144px]',
				headerHelperText: definitions.euStatus.description,
				csvValue: (row) => (row.compliance?.euStatus ? getEuStatusPresentation(row.compliance.euStatus).label : '–')
			}
		}),
		columnHelper.display({
			id: 'mica',
			header: definitions.mica.label,
			cell: ({ row }) => (
				<MicaLicenseValue
					name={row.original.name}
					mica={row.original.compliance?.mica ?? null}
					licenseCount={row.original.compliance?.licenseCount ?? null}
				/>
			),
			meta: {
				headerClassName: 'w-[119px] min-w-[119px]',
				headerHelperText: definitions.mica.description,
				csvValue: (row) => {
					const mica = row.compliance?.mica
					return mica ? (getMicaLicensePresentation(mica)?.label ?? '–') : '–'
				}
			}
		}),
		columnHelper.accessor((row) => row.compliance?.kyc?.short, {
			id: 'kyc',
			header: definitions.kyc.label,
			enableSorting: false,
			cell: ({ row }) => <KycRequirementValue name={row.original.name} kyc={row.original.compliance?.kyc ?? null} />,
			meta: {
				headerClassName: 'w-[239px] min-w-[239px]',
				headerHelperText: definitions.kyc.description,
				csvValue: (row) => {
					const kyc = row.compliance?.kyc
					if (!kyc) return '–'
					return kyc.required ? (kyc.summary ?? kyc.short ?? 'Required') : 'No KYC'
				}
			}
		}),
		columnHelper.accessor((row) => row.compliance?.licenseCount ?? undefined, {
			id: 'licenseCount',
			header: definitions.licenseCount.label,
			cell: ({ getValue }) => getValue() ?? '–',
			meta: {
				headerClassName: 'w-[114px] min-w-[114px]',
				align: 'end',
				headerHelperText: definitions.licenseCount.description
			}
		}),
		columnHelper.accessor((row) => row.profile?.founded ?? undefined, {
			id: 'founded',
			header: definitions.founded.label,
			cell: ({ getValue }) => getValue() ?? '–',
			meta: {
				headerClassName: 'w-[97px] min-w-[97px]',
				align: 'end',
				headerHelperText: definitions.founded.description
			}
		}),
		// Last column: type is a static label, not a measurement, and the merged view hides it.
		columnHelper.accessor('kind', {
			id: 'kind',
			header: definitions.kind.label,
			cell: ({ getValue }) => <KindBadge kind={getValue()} />,
			meta: { headerClassName: 'w-[71px] min-w-[71px]', headerHelperText: definitions.kind.description }
		})
	])
	return executionAvailable ? columns : columns.filter((column) => !EXECUTION_COLUMN_IDS.includes(column.id ?? ''))
}
