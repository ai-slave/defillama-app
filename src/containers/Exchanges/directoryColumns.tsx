import { type ColumnDef, createColumnHelper } from '@tanstack/react-table'
import * as React from 'react'
import { BasicLink } from '~/components/Link'
import { TokenLogo } from '~/components/TokenLogo'
import { buttonStyles } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { QuestionHelper } from '~/ui/QuestionHelper'
import { Tooltip } from '~/ui/Tooltip'
import { formattedNum } from '~/utils'
import { letterLogoDataUri } from '~/utils/icons'
import {
	EuAvailabilityValue,
	getEuStatusPresentation,
	getMicaLicensePresentation,
	KycRequirementValue,
	MicaLicenseValue
} from './ComplianceCells'
import { exchangeDefinitions } from './definitions'
import { FeeValue, feeLabel } from './feePresentation'
import { FiatFeesValue, fiatFeeSummary } from './FiatFeesValue'
import { MiniSparkline } from './MiniSparkline'
import {
	activityForScope,
	depthMetricState,
	depthTotal,
	describeChildLiquidity,
	fractionChange,
	normalizedVolumeForScope,
	sparklineForScope,
	volumeToDepth,
	volumeToOpenInterest
} from './modelHelpers'
import type { ExchangeDirectoryRowModel, ExchangeSegment, ExchangeVenueKind } from './models'
import { EXCHANGE_SEGMENT_LABELS } from './models'
import { withCountryParam } from './queryState'
import { selectVenueDestination } from './venueLinks'

const columnHelper = createColumnHelper<ExchangeDirectoryRowModel>()

function money(value: number | null | undefined): string {
	return value == null ? '–' : formattedNum(value, true)
}

function percentage(value: number | null | undefined, digits = 1): string {
	return value == null ? '–' : `${(value * 100).toFixed(digits)}%`
}

function ratio(value: number | null | undefined): string {
	if (value == null) return '–'
	return `${value >= 100 ? Math.round(value).toLocaleString() : value.toFixed(1)}×`
}

function Change({ value }: { value: number | undefined }) {
	if (value == null) return <span className="text-tertiary">–</span>
	return (
		<span
			className={value >= 0 ? 'text-data-up' : 'text-data-down'}
		>{`${value >= 0 ? '+' : ''}${percentage(value)}`}</span>
	)
}

function UnsupportedMetric() {
	return <span className="text-tertiary">N/A</span>
}

function KindBadge({ kind }: { kind: ExchangeVenueKind }) {
	return <span className="rounded-sm border border-subtle px-1.5 py-0.5 label-sm uppercase">{kind}</span>
}

function linkedMetric(value: React.ReactNode, note: string | undefined) {
	return note ? (
		<Tooltip content={note} className="ms-auto w-fit underline decoration-dotted">
			{value}
		</Tooltip>
	) : (
		value
	)
}

export function buildDirectoryColumns(scope: ExchangeSegment): ColumnDef<ExchangeDirectoryRowModel, any>[] {
	const definitions = exchangeDefinitions.directory
	return [
		columnHelper.accessor((row) => `${row.name} ${row.slug} ${row.profile?.nativeToken ?? ''}`, {
			id: 'name',
			header: definitions.name.label,
			enableSorting: false,
			cell: ({ row }) => {
				const venue = row.original
				const profileHref = withCountryParam(venue.profileHref, venue.selectedCountry)
				const reservesHref = venue.reservesHref ? withCountryParam(venue.reservesHref, venue.selectedCountry) : null
				const defillamaPath = venue.secondaryUrl
				const venueDestination = selectVenueDestination(venue.slug, venue.referralUrl, venue.websiteUrl)
				const liquidityNote = row.depth > 0 ? describeChildLiquidity(venue) : null
				return (
					<div className={`relative flex min-w-0 items-center gap-2 ${row.depth > 0 ? 'pl-12' : 'pl-6'}`}>
						{row.subRows.length > 0 ? (
							<button type="button" className="absolute -left-0.5" onClick={row.getToggleExpandedHandler()}>
								{row.getIsExpanded() ? (
									<>
										<Icon name="chevron-down" height={16} width={16} className="text-tertiary" />
										<span className="sr-only">Hide child venues</span>
									</>
								) : (
									<>
										<Icon name="chevron-right" height={16} width={16} className="text-tertiary" />
										<span className="sr-only">Show child venues</span>
									</>
								)}
							</button>
						) : null}
						<span className="vf-row-index shrink-0" aria-hidden="true" />
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
								<KindBadge kind={venue.kind} />
							</div>
							{venue.tracked ? null : <span className="body-sm text-tertiary">Metadata only</span>}
						</div>
						<div className="flex shrink-0 items-center gap-0.5">
							{reservesHref ? (
								<Tooltip content="Open reserves">
									<BasicLink
										href={reservesHref}
										aria-label={`Open ${venue.name} reserves`}
										className={buttonStyles({ variant: 'ghost', size: 'sm', square: true })}
									>
										<Icon name="wallet" className="size-4" />
									</BasicLink>
								</Tooltip>
							) : null}
							{defillamaPath ? (
								<Tooltip content={`Open ${venue.kind.toUpperCase()} profile`}>
									<BasicLink
										href={defillamaPath}
										aria-label={`Open ${venue.name} ${venue.kind.toUpperCase()} profile`}
										className={buttonStyles({ variant: 'ghost', size: 'sm', square: true })}
									>
										<Icon name="bar-chart-2" className="size-4" />
									</BasicLink>
								</Tooltip>
							) : null}
							{venueDestination ? (
								<Tooltip content="Open venue website">
									<BasicLink
										href={venueDestination.url}
										target="_blank"
										rel="noopener noreferrer"
										aria-label={`Open ${venue.name} website`}
										data-umami-event="exchange-website-click"
										data-umami-event-exchange={venue.name}
										data-umami-event-referral={venueDestination.kind === 'referral' ? 'true' : 'false'}
										data-umami-event-url={venueDestination.url}
										className={buttonStyles({ variant: 'ghost', size: 'sm', square: true })}
									>
										<Icon name="globe" className="size-4" />
									</BasicLink>
								</Tooltip>
							) : null}
						</div>
					</div>
				)
			},
			meta: {
				headerClassName: 'w-[299px] min-w-[299px]',
				headerHelperText: definitions.name.description,
				csvValue: (row) => row.name
			}
		}),
		columnHelper.accessor('kind', {
			id: 'kind',
			header: definitions.kind.label,
			cell: ({ getValue }) => <KindBadge kind={getValue()} />,
			meta: { headerClassName: 'w-[71px] min-w-[71px]', headerHelperText: definitions.kind.description }
		}),
		columnHelper.accessor((row) => activityForScope(row, scope)?.volume24h ?? undefined, {
			id: 'volume24h',
			header: definitions.volume24h.label,
			cell: ({ row, getValue }) =>
				linkedMetric(money(getValue()), activityForScope(row.original, scope)?.doubleCount?.volume),
			meta: {
				headerClassName: 'w-[124px] min-w-[124px]',
				align: 'end',
				headerHelperText: definitions.volume24h.description
			}
		}),
		columnHelper.accessor(
			(row) => {
				const activity = activityForScope(row, scope)
				return fractionChange(activity?.volume24h, activity?.volumePrevious24h) ?? undefined
			},
			{
				id: 'volumeChange24h',
				header: definitions.volumeChange24h.label,
				cell: ({ getValue }) => <Change value={getValue()} />,
				meta: {
					headerClassName: 'w-[102px] min-w-[102px]',
					align: 'end',
					headerHelperText: definitions.volumeChange24h.description
				}
			}
		),
		columnHelper.accessor((row) => activityForScope(row, scope)?.openInterestUsd ?? undefined, {
			id: 'openInterestUsd',
			header: definitions.openInterestUsd.label,
			cell: ({ row, getValue }) => {
				const activity = activityForScope(row.original, scope)
				if (!activity?.supportsOpenInterest) return <UnsupportedMetric />
				return linkedMetric(money(getValue()), activity.doubleCount?.openInterest)
			},
			meta: {
				headerClassName: 'w-[129px] min-w-[129px]',
				align: 'end',
				headerHelperText: definitions.openInterestUsd.description
			}
		}),
		columnHelper.accessor(
			(row) => {
				const activity = activityForScope(row, scope)
				return fractionChange(activity?.openInterestUsd, activity?.openInterestPreviousUsd) ?? undefined
			},
			{
				id: 'openInterestChange24h',
				header: definitions.openInterestChange24h.label,
				cell: ({ row, getValue }) =>
					activityForScope(row.original, scope)?.supportsOpenInterest ? (
						<Change value={getValue()} />
					) : (
						<UnsupportedMetric />
					),
				meta: {
					headerClassName: 'w-[89px] min-w-[89px]',
					align: 'end',
					headerHelperText: definitions.openInterestChange24h.description
				}
			}
		),
		columnHelper.accessor((row) => volumeToOpenInterest(activityForScope(row, scope)) ?? undefined, {
			id: 'volumeToOi',
			header: definitions.volumeToOi.label,
			cell: ({ row, getValue }) =>
				activityForScope(row.original, scope)?.supportsOpenInterest ? ratio(getValue()) : <UnsupportedMetric />,
			meta: {
				headerClassName: 'w-[96px] min-w-[96px]',
				align: 'end',
				headerHelperText: definitions.volumeToOi.description
			}
		}),
		columnHelper.accessor((row) => volumeToDepth(activityForScope(row, scope)) ?? undefined, {
			id: 'volumeToDepth',
			header: definitions.volumeToDepth.label,
			cell: ({ row, getValue }) =>
				activityForScope(row.original, scope)?.supportsDepth ? ratio(getValue()) : <UnsupportedMetric />,
			meta: {
				headerClassName: 'w-[110px] min-w-[110px]',
				align: 'end',
				headerHelperText: definitions.volumeToDepth.description
			}
		}),
		columnHelper.accessor((row) => activityForScope(row, scope)?.marketCount ?? undefined, {
			id: 'marketCount',
			header: definitions.marketCount.label,
			cell: ({ getValue }) => getValue() ?? '–',
			meta: {
				headerClassName: 'w-[93px] min-w-[93px]',
				align: 'end',
				headerHelperText: definitions.marketCount.description
			}
		}),
		columnHelper.accessor((row) => activityForScope(row, scope)?.coinCount ?? undefined, {
			id: 'coinCount',
			header: definitions.coinCount.label,
			cell: ({ getValue }) => getValue() ?? '–',
			meta: {
				headerClassName: 'w-[79px] min-w-[79px]',
				align: 'end',
				headerHelperText: definitions.coinCount.description
			}
		}),
		columnHelper.accessor((row) => normalizedVolumeForScope(row, scope)?.normalized ?? undefined, {
			id: 'normalizedVolume',
			header: definitions.normalizedVolume.label,
			cell: ({ row, getValue }) => {
				const nvol = normalizedVolumeForScope(row.original, scope)
				return nvol ? (
					<Tooltip
						content={`${percentage(nvol.discountFraction)} below reported · ${percentage(nvol.unverifiedFraction)} unverified${nvol.flag ? ` · ${nvol.flag}` : ''}`}
						className="ms-auto w-fit"
					>
						<span className="underline decoration-dotted">{money(getValue())}</span>
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
		columnHelper.accessor((row) => depthTotal(activityForScope(row, scope)) ?? undefined, {
			id: 'depth2Usd',
			header: definitions.depth2Usd.label,
			cell: ({ row, getValue }) => {
				const activity = activityForScope(row.original, scope)
				const metric = depthMetricState(activity)
				if (metric.state === 'unsupported') return <UnsupportedMetric />
				if (metric.state === 'missing') return <span className="text-tertiary">–</span>
				const note = [metric.partial ? 'Partial orderbook coverage' : null, activity?.doubleCount?.depth]
					.filter(Boolean)
					.join(' · ')
				return linkedMetric(money(getValue()), note || undefined)
			},
			meta: {
				headerClassName: 'w-[114px] min-w-[114px]',
				align: 'end',
				headerHelperText: definitions.depth2Usd.description
			}
		}),
		columnHelper.accessor((row) => sparklineForScope(row, scope), {
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
			cell: ({ getValue }) => money(getValue()),
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
				cell: ({ getValue }) => percentage(getValue()),
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
			cell: ({ getValue }) => money(getValue()),
			meta: {
				headerClassName: 'w-[117px] min-w-[117px]',
				align: 'end',
				headerHelperText: definitions.inflows24hUsd.description
			}
		}),
		columnHelper.accessor((row) => row.reserves?.inflows7dUsd ?? undefined, {
			id: 'inflows7dUsd',
			header: definitions.inflows7dUsd.label,
			cell: ({ getValue }) => money(getValue()),
			meta: {
				headerClassName: 'w-[114px] min-w-[114px]',
				align: 'end',
				headerHelperText: definitions.inflows7dUsd.description
			}
		}),
		columnHelper.accessor((row) => row.reserves?.inflows1mUsd ?? undefined, {
			id: 'inflows1mUsd',
			header: definitions.inflows1mUsd.label,
			cell: ({ getValue }) => money(getValue()),
			meta: {
				headerClassName: 'w-[114px] min-w-[114px]',
				align: 'end',
				headerHelperText: definitions.inflows1mUsd.description
			}
		}),
		columnHelper.accessor((row) => row.reserves?.ownTokenFraction ?? undefined, {
			id: 'ownTokenFraction',
			header: definitions.ownTokenFraction.label,
			cell: ({ getValue }) => percentage(getValue()),
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
		columnHelper.accessor((row) => activityForScope(row, scope)?.volumeUpdatedAt, {
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
					<Tooltip content={row.original.warnings.map((warning) => warning.text).join(' · ')}>
						<span className="underline decoration-dotted">{getValue()}</span>
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
			cell: ({ getValue }) =>
				getValue() ? (
					<BasicLink href={getValue()} target="_blank" rel="noopener noreferrer" className="text-link hover:underline">
						Verify
					</BasicLink>
				) : (
					'–'
				),
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
				const discount = row.original.fees?.feeToken?.discountFraction
				return getValue()
					? `${getValue().toUpperCase()}${discount == null ? '' : ` · ${percentage(discount)} off`}`
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
		columnHelper.accessor((row) => row.funding?.rampCost?.onRamp.totalUsd ?? undefined, {
			id: 'rampCost',
			header: definitions.rampCost.label,
			cell: ({ getValue }) => money(getValue()),
			meta: {
				headerClassName: 'w-[155px] min-w-[155px]',
				align: 'end',
				headerHelperText: definitions.rampCost.description
			}
		}),
		columnHelper.accessor((row) => row.compliance?.headquarters, {
			id: 'headquarters',
			header: definitions.headquarters.label,
			cell: ({ getValue }) => {
				const headquarters = getValue()
				return headquarters ? (
					<Tooltip content={headquarters} className="max-w-full">
						<span className="truncate">{headquarters}</span>
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
		})
	]
}
