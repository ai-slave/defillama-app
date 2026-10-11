import { createColumnHelper, type TableOptions } from '@tanstack/react-table'
import { useState } from 'react'
import { IconsRow } from '~/components/IconsRow'
import { chainHref, toChainIconItems } from '~/components/IconsRow/utils'
import { BasicLink } from '~/components/Link'
import type { SearchTableFeatures } from '~/components/Table/features/search'
import { Button } from '~/ui/Button'
import { Hovercard } from '~/ui/Hovercard'
import { Icon } from '~/ui/Icon'
import { Logo } from '~/ui/Logo'
import { TextLink } from '~/ui/TextLink'
import { Tooltip } from '~/ui/Tooltip'
import { geckoTokenIconUrl, letterLogoDataUri } from '~/utils/icons'
import { GetCardButton } from './GetCardButton'
import {
	type CardsReferenceModel,
	type CardBooleanField,
	type CardTableRow,
	type CardTextField,
	type TierBooleanRollup,
	VARIES_BY_TIER
} from './models'
import { TierComparisonPopover } from './TierComparisonPopover'

const columnHelper = createColumnHelper<SearchTableFeatures, CardTableRow>()

export type CardsColumnGroup = 'overview' | 'rewards' | 'fees' | 'crypto' | 'integrations' | 'limits'

export const CARDS_COLUMN_GROUPS = [
	{ value: 'overview', label: 'Overview' },
	{ value: 'rewards', label: 'Rewards' },
	{ value: 'fees', label: 'Fees' },
	{ value: 'crypto', label: 'Crypto' },
	{ value: 'integrations', label: 'Integrations' },
	{ value: 'limits', label: 'Limits' }
] as const satisfies ReadonlyArray<{ value: CardsColumnGroup; label: string }>

const ALWAYS_VISIBLE_COLUMN_IDS = ['name'] as const

const GROUP_COLUMN_IDS: Record<CardsColumnGroup, Array<string>> = {
	// Where a card works and whether it's available come first; the issuing bank matters least.
	overview: [
		'region',
		'availability',
		'cashbackRate',
		'annualFee',
		'fxFee',
		'access',
		'classification',
		'network',
		'issuer'
	],
	rewards: ['cashbackRate', 'cashbackCurrency', 'maxCashbackPerMonth', 'perks'],
	fees: ['annualFee', 'fxFee', 'atmFee', 'atmAllowance'],
	crypto: ['custody', 'supportedChains', 'supportedCoins'],
	integrations: ['virtualPhysical', 'applePay', 'googlePay', 'iban'],
	limits: ['dailySpendingLimit', 'monthlySpendingLimit', 'availability']
}

const ALL_GROUPED_COLUMN_IDS = [...new Set(Object.values(GROUP_COLUMN_IDS).flat())]

export function cardsColumnVisibility(group: CardsColumnGroup): Record<string, boolean> {
	const visible = new Set<string>([...ALWAYS_VISIBLE_COLUMN_IDS, ...GROUP_COLUMN_IDS[group]])
	return Object.fromEntries(ALL_GROUPED_COLUMN_IDS.map((id) => [id, visible.has(id)]))
}

function EmptyValue() {
	return <span className="text-tertiary">–</span>
}

/** Short free-text value that truncates in the cell but stays readable via tooltip. */
function TextValue({ row, field, value }: { row: CardTableRow; field: CardTextField; value: string | null }) {
	if (value == null) return <EmptyValue />
	if (value === VARIES_BY_TIER) return <TierComparisonPopover row={row} field={field} />
	return (
		<Tooltip content={value.length > 24 ? value : null}>
			<span className="block truncate">{value}</span>
		</Tooltip>
	)
}

/** Long free-text value, clamped to two lines so one verbose cell can't set the
 *  height of an otherwise single-line row. The tooltip carries the remainder;
 *  the threshold is about two lines at the narrowest prose column (130px), the
 *  two-line counterpart to TextValue's 24. */
const PROSE_CLAMP_CHARS = 40

function ProseValue({ row, field, value }: { row: CardTableRow; field: CardTextField; value: string | null }) {
	if (value == null) return <EmptyValue />
	if (value === VARIES_BY_TIER) return <TierComparisonPopover row={row} field={field} />
	return (
		<Tooltip content={value.length > PROSE_CLAMP_CHARS ? value : null}>
			{/* w-full/min-w-0: the tooltip anchor is a flex row, so the span needs a
			    bounded width to wrap rather than overflow on one line. */}
			<span className="line-clamp-2 w-full min-w-0 whitespace-normal">{value}</span>
		</Tooltip>
	)
}

/** Perk chips are a wrapping list, so the prose clamp can't reach them — one
 *  card's 13 perks pushed its row to 351px. The row instead packs as many chips
 *  as actually fit on one line and hides the rest behind a counter, the same way
 *  IconsRow handles chain and coin overflow. A fixed count per breakpoint can't
 *  work here: two chips are 507px worst case, more than the column has below
 *  ~2560px, so the count has to come from the real width. */
const PERK_GAP = 4

/** Measured once per distinct label — 32 perks across the whole table — against
 *  the font read off a live chip, so the numbers can't drift from the classes. */
const perkChipWidths = new Map<string, number>()
let perkChipFont = ''
let perkChipChrome = 0
let perkTextContext: CanvasRenderingContext2D | null = null

function perkChipWidth(label: string, sample: Element): number {
	const cached = perkChipWidths.get(label)
	if (cached != null) return cached
	if (!perkTextContext) {
		perkTextContext = document.createElement('canvas').getContext('2d')!
		const styles = getComputedStyle(sample)
		perkChipFont = `${styles.fontWeight} ${styles.fontSize} ${styles.fontFamily}`
		perkChipChrome =
			parseFloat(styles.paddingLeft) +
			parseFloat(styles.paddingRight) +
			parseFloat(styles.borderLeftWidth) +
			parseFloat(styles.borderRightWidth)
	}
	perkTextContext.font = perkChipFont
	const width = Math.ceil(perkTextContext.measureText(label).width) + perkChipChrome
	perkChipWidths.set(label, width)
	return width
}

const perkChipStyles = 'rounded-full border border-medium px-2 py-1 label-sm whitespace-nowrap text-secondary'

function PerkChips({ perks }: { perks: Array<string> }) {
	return (
		<>
			{perks.map((perk) => (
				<span key={perk} className={perkChipStyles}>
					{perk}
				</span>
			))}
		</>
	)
}

/** How many chips fit on one line of `width`, keeping room for the counter. Always at least one. */
function countFittingPerks(perks: Array<string>, width: number, sample: Element): number {
	let used = 0
	let count = 0
	for (const [index, perk] of perks.entries()) {
		const chip = perkChipWidth(perk, sample) + (index ? PERK_GAP : 0)
		const stillHidden = perks.length - index - 1
		// Keep room for the counter unless this chip empties the list.
		const counter = stillHidden ? PERK_GAP + perkChipWidth(`+${stillHidden}`, sample) : 0
		if (used + chip + counter > width) break
		used += chip
		count += 1
	}
	return Math.max(count, 1)
}

function PerksValue({ perks }: { perks: Array<string> }) {
	// One chip until the row has been measured, which is also what SSR renders.
	const [visible, setVisible] = useState(1)
	// Re-attaches when `perks` changes, so a new list is recounted against the same row.
	const fitPerks = (row: HTMLDivElement | null) => {
		const sample = row?.firstElementChild
		if (!row || !sample) return
		const measure = () => {
			if (row.offsetWidth) setVisible(countFittingPerks(perks, row.offsetWidth, sample))
		}
		measure()
		const observer = new ResizeObserver(measure)
		observer.observe(row, { box: 'border-box' })
		return () => observer.disconnect()
	}

	if (perks.length === 0) return <EmptyValue />
	const hidden = perks.slice(visible)
	return (
		<div ref={fitPerks} className="flex flex-nowrap items-center gap-1 overflow-hidden">
			<PerkChips perks={perks.slice(0, visible)} />
			{hidden.length > 0 ? (
				<Hovercard
					placement="right-start"
					render={<button type="button" />}
					className={`${perkChipStyles} text-primary`}
					content={
						<div className="flex max-w-72 flex-wrap gap-1">
							<PerkChips perks={hidden} />
						</div>
					}
				>
					{`+${hidden.length}`}
					<span className="sr-only">more perks</span>
				</Hovercard>
			) : null}
		</div>
	)
}

function BooleanValue({ row, field, value }: { row: CardTableRow; field: CardBooleanField; value: TierBooleanRollup }) {
	if (value == null) return <EmptyValue />
	if (value === VARIES_BY_TIER) return <TierComparisonPopover row={row} field={field} />
	return value ? (
		<span>
			<Icon name="check" className="inline size-4 text-success" />
			<span className="sr-only">Yes</span>
		</span>
	) : (
		<span>
			<Icon name="x" className="inline size-4 text-tertiary" />
			<span className="sr-only">No</span>
		</span>
	)
}

function booleanCsv(value: TierBooleanRollup): string {
	return value == null ? '' : value === VARIES_BY_TIER ? value : value ? 'Yes' : 'No'
}

/** Enum values arrive lowercased ("debit", "visa", "self-custodial"). */
function capitalize(value: string | null): string | null {
	return value ? `${value.slice(0, 1).toUpperCase()}${value.slice(1)}` : null
}

function availabilityLabel(row: Pick<CardTableRow, 'availabilityUnknown' | 'countryCount'>): string | null {
	if (row.availabilityUnknown) return null
	return `${row.countryCount} ${row.countryCount === 1 ? 'country' : 'countries'}`
}

export function buildCardsColumns(
	reference: CardsReferenceModel
): TableOptions<SearchTableFeatures, CardTableRow>['columns'] {
	return [
		columnHelper.accessor((row) => `${row.cardName} ${row.tierName} ${row.cardId}`, {
			id: 'name',
			enableHiding: false,
			header: 'Card',
			enableSorting: false,
			cell: ({ row }) => {
				const card = row.original
				if (card.rowKind === 'tier') {
					return (
						<span className={`block truncate label-md text-secondary ${row.depth > 1 ? 'pl-20' : 'pl-14'}`}>
							{card.tierName}
						</span>
					)
				}
				const nestedCard = card.rowKind === 'card' && row.depth > 0
				const expansionLabel = card.rowKind === 'parent' ? 'cards' : 'tiers'
				return (
					<div className={`relative flex w-full min-w-0 items-center gap-2 ${nestedCard ? 'pl-12' : 'pl-6'}`}>
						{row.getCanExpand() ? (
							<Button
								variant="ghost"
								size="sm"
								square
								className={`absolute ${nestedCard ? 'left-5' : '-left-1'}`}
								onClick={row.getToggleExpandedHandler()}
								aria-expanded={row.getIsExpanded()}
							>
								{row.getIsExpanded() ? (
									<>
										<Icon name="chevron-down" className="size-4 text-tertiary" />
										<span className="sr-only">{`Hide ${expansionLabel}`}</span>
									</>
								) : (
									<>
										<Icon name="chevron-right" className="size-4 text-tertiary" />
										<span className="sr-only">{`View ${expansionLabel}`}</span>
									</>
								)}
							</Button>
						) : null}
						<Logo
							size={24}
							src={card.logo}
							fallbackSrc={letterLogoDataUri(card.cardName)}
							alt={`${card.cardName} logo`}
						/>
						{/* The name opens the card page; the Get pill beside it is the one way to the issuer. */}
						<div className="flex min-w-0 flex-1 items-center gap-1">
							{reference.detailsHrefByIssuer[card.parentId] ? (
								<TextLink href={reference.detailsHrefByIssuer[card.parentId]} truncate className="block max-w-fit">
									{card.cardName}
								</TextLink>
							) : (
								<span className="block truncate label-md">{card.cardName}</span>
							)}
							{card.cardId === 'gnosis-pay' ? (
								<Hovercard
									placement="right-start"
									render={
										<Button variant="ghost" size="sm" square aria-label="Gnosis Pay card discontinuation warning" />
									}
									content={
										<div className="w-64 max-w-full space-y-2 body-sm">
											<p>
												The Gnosis Pay card will be discontinued on <strong>20 December 2026</strong> at 23:59 UTC.
											</p>
											<BasicLink
												href="https://help.gnosispay.com/articles/1452055581-formal-notice-closure-of-the-gnosis-pay-web-app-and-card-21-september-2026"
												target="_blank"
												rel="noopener noreferrer"
												className="text-link underline"
											>
												Read the official notice
											</BasicLink>
										</div>
									}
								>
									<Icon name="alert-triangle" className="size-3.5 text-warning" aria-hidden="true" />
								</Hovercard>
							) : null}
						</div>
						{card.rowKind === 'card' ? (
							<GetCardButton cardId={card.cardId} cardName={card.cardName} url={card.url} placement="table" />
						) : null}
					</div>
				)
			},
			meta: {
				headerClassName: 'w-[min(288px,58vw)]',
				csvValue: (row) => (row.tierName ? `${row.cardName} — ${row.tierName}` : row.cardName)
			}
		}),
		columnHelper.accessor((row) => row.region, {
			id: 'region',
			header: 'Region',
			// Regions mix blocs, single countries and "Global", so A–Z order means nothing; the
			// Availability filter answers "does it work where I live".
			enableSorting: false,
			cell: ({ row }) => <TextValue row={row.original} field="region" value={row.original.region || null} />,
			meta: {
				headerClassName: 'w-[118px] min-w-[118px]',
				headerHelperText: 'Region this tier’s terms apply to.'
			}
		}),
		columnHelper.accessor((row) => (row.availabilityUnknown ? undefined : row.countryCount), {
			id: 'availability',
			header: 'Availability',
			cell: ({ row }) => {
				const label = availabilityLabel(row.original)
				return label == null ? <EmptyValue /> : <span className="whitespace-nowrap">{label}</span>
			},
			meta: {
				headerClassName: 'w-[120px] min-w-[120px] whitespace-nowrap',
				align: 'end',
				headerHelperText: 'Countries where the card can be issued.',
				csvValue: (row) => availabilityLabel(row) ?? ''
			}
		}),
		columnHelper.accessor((row) => row.cashbackRate ?? undefined, {
			id: 'cashbackRate',
			header: 'Cashback',
			enableSorting: false,
			cell: ({ row }) => <ProseValue row={row.original} field="cashbackRate" value={row.original.cashbackRate} />,
			meta: {
				headerClassName: 'w-[200px] min-w-[200px] 2xl:w-[260px] 2xl:min-w-[260px]',
				headerHelperText: 'Advertised cashback rate, including tier conditions.'
			}
		}),
		columnHelper.accessor((row) => row.cashbackCurrency ?? undefined, {
			id: 'cashbackCurrency',
			header: 'Cashback currency',
			enableSorting: false,
			cell: ({ row }) => {
				const currency = row.original.cashbackCurrency
				if (currency == null) return <EmptyValue />
				if (currency === VARIES_BY_TIER) return <TierComparisonPopover row={row.original} field="cashbackCurrency" />
				const geckoId = reference.coinGeckoIds[currency]
				return (
					<span className="flex items-center gap-1.5">
						{geckoId ? (
							<Logo
								size={24}
								src={geckoTokenIconUrl(geckoId)}
								fallbackSrc={letterLogoDataUri(currency)}
								alt={`${currency} logo`}
							/>
						) : null}
						<span className="min-w-0 whitespace-normal">{currency}</span>
					</span>
				)
			},
			meta: {
				headerClassName: 'w-[175px] min-w-[175px]',
				headerHelperText: 'What cashback is paid in.'
			}
		}),
		columnHelper.accessor((row) => row.maxCashbackPerMonth ?? undefined, {
			id: 'maxCashbackPerMonth',
			header: 'Monthly cap',
			enableSorting: false,
			cell: ({ row }) => (
				<ProseValue row={row.original} field="maxCashbackPerMonth" value={row.original.maxCashbackPerMonth} />
			),
			meta: {
				headerClassName: 'w-[130px] min-w-[130px]',
				headerHelperText: 'Maximum cashback earnable per month.'
			}
		}),
		columnHelper.accessor((row) => row.perks.join(', '), {
			id: 'perks',
			header: 'Perks',
			enableSorting: false,
			cell: ({ row }) => <PerksValue perks={row.original.perks} />,
			meta: {
				headerClassName: 'w-[310px] min-w-[310px]',
				csvValue: (row) => row.perks.join(', ')
			}
		}),
		columnHelper.accessor((row) => row.annualFee ?? undefined, {
			id: 'annualFee',
			header: 'Annual fee',
			enableSorting: false,
			cell: ({ row }) => <ProseValue row={row.original} field="annualFee" value={row.original.annualFee} />,
			meta: {
				headerClassName: 'w-[130px] min-w-[130px]'
			}
		}),
		columnHelper.accessor((row) => row.fxFee ?? undefined, {
			id: 'fxFee',
			header: 'FX fee',
			enableSorting: false,
			cell: ({ row }) => <ProseValue row={row.original} field="fxFee" value={row.original.fxFee} />,
			meta: {
				headerClassName: 'w-[230px] min-w-[230px] 2xl:w-[300px] 2xl:min-w-[300px]',
				headerHelperText: 'Foreign-exchange markup on non-base-currency transactions.'
			}
		}),
		columnHelper.accessor((row) => row.atmFee ?? undefined, {
			id: 'atmFee',
			header: 'ATM fee',
			enableSorting: false,
			cell: ({ row }) => <TextValue row={row.original} field="atmFee" value={row.original.atmFee} />,
			meta: {
				headerClassName: 'w-[86px] min-w-[86px] whitespace-nowrap',
				align: 'end',
				headerHelperText: 'Fee on ATM withdrawals.'
			}
		}),
		columnHelper.accessor((row) => row.atmAllowance ?? undefined, {
			id: 'atmAllowance',
			header: 'ATM allowance',
			enableSorting: false,
			cell: ({ row }) => <ProseValue row={row.original} field="atmAllowance" value={row.original.atmAllowance} />,
			meta: {
				headerClassName: 'w-[250px] min-w-[250px] 2xl:w-[310px] 2xl:min-w-[310px]',
				headerHelperText: 'Fee-free ATM withdrawal allowance.'
			}
		}),
		columnHelper.accessor((row) => row.access ?? undefined, {
			id: 'access',
			header: 'Requirements',
			enableSorting: false,
			cell: ({ row }) => <ProseValue row={row.original} field="access" value={row.original.access} />,
			meta: {
				headerClassName: 'w-[170px] min-w-[170px] 2xl:w-[180px] 2xl:min-w-[180px]',
				headerHelperText: 'What unlocks this tier: deposits, stakes, points, or fees. None means anyone can get it.'
			}
		}),
		columnHelper.accessor((row) => capitalize(row.cardClassification) ?? undefined, {
			id: 'classification',
			header: 'Type',
			cell: ({ row }) => (
				<TextValue row={row.original} field="cardClassification" value={capitalize(row.original.cardClassification)} />
			),
			meta: {
				headerClassName: 'w-[116px] min-w-[116px] whitespace-nowrap',
				headerHelperText: 'Debit, credit, prepaid, or spend.',
				csvValue: (row) => capitalize(row.cardClassification) ?? ''
			}
		}),
		columnHelper.accessor((row) => capitalize(row.network) ?? undefined, {
			id: 'network',
			header: 'Network',
			cell: ({ row }) => <TextValue row={row.original} field="network" value={capitalize(row.original.network)} />,
			meta: {
				headerClassName: 'w-[104px] min-w-[104px] whitespace-nowrap',
				headerHelperText: 'Payment network the card runs on.',
				csvValue: (row) => capitalize(row.network) ?? ''
			}
		}),
		columnHelper.accessor((row) => row.issuer ?? undefined, {
			id: 'issuer',
			header: 'Issuer',
			cell: ({ row }) => <TextValue row={row.original} field="issuer" value={row.original.issuer} />,
			meta: {
				headerClassName: 'w-[122px] min-w-[122px] whitespace-nowrap',
				headerHelperText: 'Issuing bank / BIN sponsor.'
			}
		}),
		columnHelper.accessor((row) => capitalize(row.custodyType) ?? undefined, {
			id: 'custody',
			header: 'Custody',
			cell: ({ row }) => (
				<TextValue row={row.original} field="custodyType" value={capitalize(row.original.custodyType)} />
			),
			meta: {
				headerClassName: 'w-[120px] min-w-[120px] whitespace-nowrap',
				csvValue: (row) => capitalize(row.custodyType) ?? ''
			}
		}),
		columnHelper.accessor((row) => (row.supportedChains.length > 0 ? row.supportedChains.length : undefined), {
			id: 'supportedChains',
			header: 'Chains',
			cell: ({ row }) => (
				<IconsRow
					items={toChainIconItems(
						row.original.supportedChains.map((chain) => reference.chainNames[chain] ?? chain),
						(chain) => chainHref('/chain', chain)
					)}
				/>
			),
			meta: {
				headerClassName: 'w-[200px] min-w-[200px]',
				align: 'end',
				headerHelperText: 'Chains the card can be funded from.',
				csvValue: (row) => row.supportedChains.join(', ')
			}
		}),
		columnHelper.accessor((row) => (row.supportedCoins.length > 0 ? row.supportedCoins.length : undefined), {
			id: 'supportedCoins',
			header: 'Coins',
			cell: ({ row }) => (
				<IconsRow
					items={row.original.supportedCoins.map((symbol) => {
						const geckoId = reference.coinGeckoIds[symbol]
						return {
							label: symbol,
							kind: 'token' as const,
							src: geckoId ? geckoTokenIconUrl(geckoId) : null,
							...(geckoId ? { href: `/token/${encodeURIComponent(symbol)}` } : {})
						}
					})}
				/>
			),
			meta: {
				headerClassName: 'w-[200px] min-w-[200px]',
				cellClassName: 'items-top py-0 shrink-0',
				align: 'end',
				headerHelperText: 'Tokens the card can spend or be funded with.',
				csvValue: (row) => row.supportedCoins.join(', ')
			}
		}),
		columnHelper.accessor((row) => row.virtualPhysical ?? undefined, {
			id: 'virtualPhysical',
			header: 'Card form',
			cell: ({ row }) => <TextValue row={row.original} field="virtualPhysical" value={row.original.virtualPhysical} />,
			meta: {
				headerClassName: 'w-[158px] min-w-[158px] whitespace-nowrap',
				headerHelperText: 'Whether the card is virtual, physical, or both.'
			}
		}),
		columnHelper.accessor((row) => row.applePay ?? undefined, {
			id: 'applePay',
			header: 'Apple Pay',
			cell: ({ row }) => <BooleanValue row={row.original} field="applePay" value={row.original.applePay} />,
			meta: {
				headerClassName: 'w-[112px] min-w-[112px] whitespace-nowrap',
				align: 'end',
				headerHelperText: 'Whether the card can be added to Apple Pay.',
				csvValue: (row) => booleanCsv(row.applePay)
			}
		}),
		columnHelper.accessor((row) => row.googlePay ?? undefined, {
			id: 'googlePay',
			header: 'Google Pay',
			cell: ({ row }) => <BooleanValue row={row.original} field="googlePay" value={row.original.googlePay} />,
			meta: {
				headerClassName: 'w-[120px] min-w-[120px] whitespace-nowrap',
				align: 'end',
				headerHelperText: 'Whether the card can be added to Google Pay.',
				csvValue: (row) => booleanCsv(row.googlePay)
			}
		}),
		columnHelper.accessor((row) => row.iban ?? undefined, {
			id: 'iban',
			header: 'IBAN',
			cell: ({ row }) => <BooleanValue row={row.original} field="iban" value={row.original.iban} />,
			meta: {
				headerClassName: 'w-[78px] min-w-[78px] whitespace-nowrap',
				align: 'end',
				headerHelperText: 'Whether the card account comes with an IBAN for bank transfers.',
				csvValue: (row) => booleanCsv(row.iban)
			}
		}),
		columnHelper.accessor((row) => row.dailySpendingLimit ?? undefined, {
			id: 'dailySpendingLimit',
			header: 'Daily limit',
			enableSorting: false,
			cell: ({ row }) => (
				<ProseValue row={row.original} field="dailySpendingLimit" value={row.original.dailySpendingLimit} />
			),
			meta: {
				headerClassName: 'w-[170px] min-w-[170px] 2xl:w-[230px] 2xl:min-w-[230px]',
				headerHelperText: 'Provider-set daily spending limit.'
			}
		}),
		columnHelper.accessor((row) => row.monthlySpendingLimit ?? undefined, {
			id: 'monthlySpendingLimit',
			header: 'Monthly limit',
			enableSorting: false,
			cell: ({ row }) => (
				<ProseValue row={row.original} field="monthlySpendingLimit" value={row.original.monthlySpendingLimit} />
			),
			meta: {
				headerClassName: 'w-[200px] min-w-[200px] 2xl:w-[240px] 2xl:min-w-[240px]',
				headerHelperText: 'Provider-set monthly spending limit.'
			}
		})
	]
}
