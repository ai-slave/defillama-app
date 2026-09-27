import clsx from 'clsx'
import { BasicLink } from '~/components/Link'
import { Hovercard } from '~/ui/Hovercard'
import { Tooltip } from '~/ui/Tooltip'
import type { RWAOverviewDisplayRow } from '../../api.types'
import { normalizeRwaAssetGroup } from '../../assetGroup'
import { definitions } from '../../definitions'
import { getRwaPlatforms, UNKNOWN_PLATFORM } from '../../grouping'
import { rwaSlug } from '../../rwaSlug'
import { getRwaCategoryLabels, type RWATableRow } from '../rows'
import { asCsvOnly, columnHelper, DefinedValueCell, DistinctListCell, getLeafRow, textColumnMeta } from './shared'

const PLATFORM_HELP = 'Platform associated with issuance, custody, trading, or management of the asset.'

const ACCESS_MODEL_TONE: Record<string, string> = {
	Permissioned: 'text-warning',
	Permissionless: 'text-data-up',
	'Non-transferable': 'text-data-down',
	'Custodial Only': 'text-data-down'
}

function getAsset(row: Parameters<typeof getLeafRow>[0]): RWAOverviewDisplayRow | null {
	return getLeafRow(row)?.asset ?? null
}

/** Classes on the cell, the asset group in the tooltip. */
function LeafAssetTypeCell({ asset }: { asset: RWAOverviewDisplayRow }) {
	const assetClasses = asset.assetClass ?? []
	const assetGroup = normalizeRwaAssetGroup(asset.assetGroup)
	if (assetClasses.length === 0) return <span className="truncate">{assetGroup}</span>
	return (
		<Hovercard
			content={
				<span className="flex flex-col gap-1">
					<span>
						<strong>{definitions.assetGroup.label}</strong>: {assetGroup}
					</span>
					{assetClasses.map((assetClass) => (
						<span key={assetClass}>
							<strong>{assetClass}</strong>: {definitions.assetClass.values?.[assetClass] || 'No description'}
						</span>
					))}
				</span>
			}
			contentClassName="w-80 max-w-(--popover-available-width) p-3 whitespace-normal"
			className="max-w-full"
		>
			<span className="truncate">{assetClasses.join(', ')}</span>
		</Hovercard>
	)
}

/** Group rows list asset groups (Bonds), asset rows their classes (T-Bills); the export keeps both as columns. */
export const assetTypeColumn = columnHelper.accessor(
	(row) =>
		row.kind === 'group'
			? row.distinct.assetGroup.join(', ')
			: row.asset.assetClass?.join(', ') || normalizeRwaAssetGroup(row.asset.assetGroup),
	{
		id: 'assetGroup',
		header: 'Asset Type',
		enableSorting: false,
		cell: ({ row }) =>
			row.original.kind === 'group' ? (
				<DistinctListCell values={row.original.distinct.assetGroup} />
			) : (
				<LeafAssetTypeCell asset={row.original.asset} />
			),
		meta: {
			...textColumnMeta(
				'w-[168px]',
				`${definitions.assetGroup.description} A platform or venue row lists the asset groups of its assets; an asset row shows its asset class, with the group in the tooltip.`,
				definitions.assetGroup.label
			),
			csvValue: (row: RWATableRow) =>
				row.kind === 'group' ? row.distinct.assetGroup.join(', ') : normalizeRwaAssetGroup(row.asset.assetGroup)
		}
	}
)

export const platformColumn = columnHelper.accessor(
	(row) =>
		row.kind === 'group' ? row.distinct.platform.join(', ') : getRwaPlatforms(row.asset.parentPlatform).join(', '),
	{
		id: 'platform',
		header: 'Platform',
		enableSorting: false,
		cell: ({ row }) => {
			if (row.original.kind === 'group') return <DistinctListCell values={row.original.distinct.platform} />
			const asset = getAsset(row.original)
			if (!asset) return null
			const [platform] = getRwaPlatforms(asset.parentPlatform)
			if (platform === UNKNOWN_PLATFORM) return <span className="truncate">{platform}</span>
			return (
				<BasicLink href={`/rwa/platform/${rwaSlug(platform)}`} className="truncate text-link hover:underline">
					{platform}
				</BasicLink>
			)
		},
		meta: textColumnMeta('w-[168px]', PLATFORM_HELP)
	}
)

export const categoryColumn = columnHelper.accessor(
	(row) =>
		row.kind === 'group' ? row.distinct.category.join(', ') : getRwaCategoryLabels(row.asset).join(', ') || undefined,
	{
		id: 'category',
		header: definitions.category.label,
		enableSorting: false,
		cell: ({ row }) => {
			if (row.original.kind === 'group') return <DistinctListCell values={row.original.distinct.category} />
			const asset = getAsset(row.original)
			const labels = asset ? getRwaCategoryLabels(asset) : []
			if (labels.length === 0) return null
			return (
				<Tooltip
					content={
						<span className="flex flex-col gap-2">
							{labels.map((category) => {
								const description = definitions.category.values?.[category]
								return (
									<span key={category}>
										<strong>{category}</strong>
										{description ? (
											<>
												<br />
												{description}
											</>
										) : null}
									</span>
								)
							})}
						</span>
					}
					className="inline-block max-w-full justify-end truncate"
				>
					{labels.join(', ')}
				</Tooltip>
			)
		},
		meta: textColumnMeta('w-[168px]', definitions.category.description)
	}
)

const assetClassColumn = columnHelper.accessor(
	(row) => (row.kind === 'group' ? row.distinct.assetClass.join(', ') : (row.asset.assetClass?.join(', ') ?? '')),
	{
		id: 'assetClass',
		header: definitions.assetClass.label,
		meta: textColumnMeta('w-[168px]', definitions.assetClass.description, definitions.assetClass.label)
	}
)

export const accessModelColumn = columnHelper.accessor(
	(row) => (row.kind === 'group' ? row.distinct.accessModel.join(', ') : (row.asset.accessModel ?? undefined)),
	{
		id: 'accessModel',
		header: definitions.accessModel.label,
		enableSorting: false,
		cell: ({ row, getValue }) =>
			row.original.kind === 'group' ? (
				<DistinctListCell values={row.original.distinct.accessModel} />
			) : (
				<DefinedValueCell
					value={getValue()}
					definition={getValue() ? definitions.accessModel.values?.[getValue()] : undefined}
					className={clsx(getValue() && ACCESS_MODEL_TONE[getValue()])}
				/>
			),
		meta: textColumnMeta('w-[min(180px,40vw)]', definitions.accessModel.description)
	}
)

export const rwaClassificationColumn = columnHelper.accessor(
	(row) =>
		row.kind === 'group' ? row.distinct.rwaClassification.join(', ') : (row.asset.rwaClassification ?? undefined),
	{
		id: 'rwaClassification',
		header: definitions.rwaClassification.label,
		enableSorting: false,
		cell: ({ row, getValue }) => {
			if (row.original.kind === 'group') return <DistinctListCell values={row.original.distinct.rwaClassification} />
			const asset = getAsset(row.original)
			const value = getValue()
			const definition = asset?.trueRWA
				? definitions.rwaClassification.values?.['True RWA']
				: value
					? definitions.rwaClassification.values?.[value]
					: undefined
			return <DefinedValueCell value={value} definition={definition} className={asset?.trueRWA ? 'text-data-up' : ''} />
		},
		meta: textColumnMeta('w-[min(180px,40vw)]', definitions.rwaClassification.description)
	}
)

export const issuerColumn = columnHelper.accessor(
	(row) => (row.kind === 'group' ? row.distinct.issuer.join(', ') : (row.asset.issuer ?? undefined)),
	{
		id: 'issuer',
		header: definitions.issuer.label,
		enableSorting: false,
		cell: ({ row, getValue }) =>
			row.original.kind === 'group' ? (
				<DistinctListCell values={row.original.distinct.issuer} />
			) : (
				<span title={getValue()} className="truncate">
					{getValue()}
				</span>
			),
		meta: textColumnMeta('w-[168px]', definitions.issuer.description)
	}
)

/** Export only; the name cell shows the flag as an icon. */
export const suspiciousCsvColumns = [
	columnHelper.accessor((row) => (row.kind === 'group' ? undefined : row.asset.suspicious), {
		id: 'suspicious',
		header: 'Suspicious',
		meta: { hidden: true, csvOnly: true }
	}),
	columnHelper.accessor((row) => (row.kind === 'group' ? undefined : (row.asset.suspiciousReason ?? '')), {
		id: 'suspiciousReason',
		header: 'Suspicious reason',
		meta: { hidden: true, csvOnly: true }
	})
]

export const assetDetailColumns = [
	platformColumn,
	issuerColumn,
	accessModelColumn,
	asCsvOnly(assetClassColumn),
	asCsvOnly(categoryColumn),
	asCsvOnly(rwaClassificationColumn)
]

export const perpsDetailColumns = [platformColumn, asCsvOnly(assetClassColumn)]

/** The Compliance preset's own columns, painted; the rest of the asset details stay csv-only behind them. */
export const complianceDetailColumns = [issuerColumn, accessModelColumn]
export const complianceHiddenDetailColumns = [
	platformColumn,
	asCsvOnly(assetClassColumn),
	asCsvOnly(categoryColumn),
	asCsvOnly(rwaClassificationColumn)
]
