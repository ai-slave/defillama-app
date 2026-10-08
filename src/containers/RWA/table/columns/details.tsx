import clsx from 'clsx'
import { BasicLink } from '~/components/Link'
import { Hovercard } from '~/ui/Hovercard'
import { Tooltip } from '~/ui/Tooltip'
import type { RWAOverviewDisplayRow } from '../../api.types'
import { normalizeRwaAssetGroup } from '../../assetGroup'
import { definitions } from '../../definitions'
import { getRwaAssetGroupHref } from '../classificationHrefs'
import { getRwaCategoryLabels, type RWATableRow } from '../rows'
import { platformColumn } from './platform'
import {
	asCsvOnly,
	columnHelper,
	createDistinctTextColumn,
	DefinedValueCell,
	DistinctListCell,
	getLeafRow,
	type RWAGroupTextFold,
	textColumnMeta
} from './shared'

const ACCESS_MODEL_TONE: Record<string, string> = {
	Permissioned: 'text-warning',
	Permissionless: 'text-data-up',
	'Non-transferable': 'text-data-down',
	'Custodial Only': 'text-data-down'
}

function getAsset(row: Parameters<typeof getLeafRow>[0]): RWAOverviewDisplayRow | null {
	return getLeafRow(row)?.asset ?? null
}

function AssetGroupLink({ assetGroup, kind }: { assetGroup: string; kind: RWAOverviewDisplayRow['kind'] }) {
	const href = getRwaAssetGroupHref(assetGroup, kind)
	if (!href) return <span className="truncate">{assetGroup}</span>
	return (
		<BasicLink href={href} className="truncate text-link hover:underline">
			{assetGroup}
		</BasicLink>
	)
}

/** Classes on the cell, the asset group in the tooltip as a link to its page; no class shows the group link itself. */
function LeafAssetTypeCell({ asset }: { asset: RWAOverviewDisplayRow }) {
	const assetClasses = asset.assetClass ?? []
	const assetGroup = normalizeRwaAssetGroup(asset.assetGroup)
	if (assetClasses.length === 0) return <AssetGroupLink assetGroup={assetGroup} kind={asset.kind} />
	return (
		<Hovercard
			placement="right-start"
			content={
				<span className="flex flex-col gap-1">
					<span>
						<strong>{definitions.assetGroup.label}</strong>:{' '}
						<AssetGroupLink assetGroup={assetGroup} kind={asset.kind} />
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
		cell: ({ row }) => {
			const original = row.original
			if (original.kind !== 'group') return <LeafAssetTypeCell asset={original.asset} />
			// A group holds one row kind, so its first child says which tree the group pages live in.
			const kind = original.children[0]?.asset.kind ?? 'spot'
			return (
				<DistinctListCell
					values={original.distinct.assetGroup}
					href={(assetGroup) => getRwaAssetGroupHref(assetGroup, kind)}
				/>
			)
		},
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
					render={<span className="inline-block max-w-full truncate" />}
				>
					{labels.join(', ')}
				</Tooltip>
			)
		},
		meta: textColumnMeta('w-[168px]', definitions.category.description)
	}
)

const assetClassColumn = createDistinctTextColumn({
	id: 'assetClass',
	header: definitions.assetClass.label,
	pick: (asset) => asset.assetClass?.join(', '),
	meta: textColumnMeta('w-[168px]', definitions.assetClass.description, definitions.assetClass.label)
})

/** Coloured wherever one value applies: on a leaf, and on a group whose children share it. */
export function createAccessModelColumn(fold: RWAGroupTextFold) {
	return createDistinctTextColumn({
		id: 'accessModel',
		header: definitions.accessModel.label,
		pick: (asset) => asset.accessModel,
		fold,
		render: (value) => (
			<DefinedValueCell
				value={value}
				definition={definitions.accessModel.values?.[value]}
				className={clsx(ACCESS_MODEL_TONE[value])}
			/>
		),
		meta: textColumnMeta('w-[min(180px,40vw)]', definitions.accessModel.description)
	})
}

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

const accessModelColumn = createAccessModelColumn('list')
const issuerColumn = createDistinctTextColumn({
	id: 'issuer',
	header: definitions.issuer.label,
	pick: (asset) => asset.issuer,
	meta: textColumnMeta('w-[168px]', definitions.issuer.description)
})

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

/** The Compliance set's own columns, painted; the rest of the asset details stay csv-only behind them. */
export const complianceDetailColumns = [issuerColumn, accessModelColumn]
export const complianceHiddenDetailColumns = [
	platformColumn,
	asCsvOnly(assetClassColumn),
	asCsvOnly(categoryColumn),
	asCsvOnly(rwaClassificationColumn)
]
