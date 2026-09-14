import { BasicLink } from '~/components/Link'
import { TokenLogo } from '~/components/TokenLogo'
import { Icon } from '~/ui/Icon'
import { RWASuspiciousWarning } from '../../SuspiciousWarning'
import type { RWAGroupRow, RWALeafRow } from '../rows'
import { columnHelper } from './shared'

export const nameColumn = columnHelper.accessor(
	(row) => (row.kind === 'group' ? row.label : row.asset.assetName || row.asset.ticker),
	{
		id: 'name',
		header: 'Name',
		enableSorting: false,
		/* The row state is read here, in the cell function, and handed down as values: a component that read
		   `row.getIsExpanded()` itself would be memoized on the row's stable identity and freeze. */
		cell: ({ row }) =>
			row.original.kind === 'group' ? (
				<GroupNameCell group={row.original} expanded={row.getIsExpanded()} onToggle={row.getToggleExpandedHandler()} />
			) : (
				<LeafNameCell leaf={row.original} nested={row.depth > 0} />
			),
		meta: { headerClassName: 'w-[200px] sm:w-[260px]' }
	}
)

function GroupNameCell({ group, expanded, onToggle }: { group: RWAGroupRow; expanded: boolean; onToggle: () => void }) {
	return (
		<span className="relative flex items-center gap-2 pl-6">
			<button type="button" className="absolute -left-0.5" aria-expanded={expanded} onClick={onToggle}>
				<Icon name={expanded ? 'chevron-down' : 'chevron-right'} height={16} width={16} className="text-tertiary" />
				<span className="sr-only">{expanded ? 'Hide' : 'Show'} assets</span>
			</button>
			<span className="vf-row-index shrink-0" aria-hidden="true" />
			{group.icon?.kind === 'chain' ? (
				<TokenLogo name={group.icon.name} kind="chain" size={24} alt={`Logo of ${group.label}`} />
			) : group.icon?.kind === 'src' ? (
				<TokenLogo src={group.icon.src} size={24} alt={`Logo of ${group.label}`} />
			) : null}
			<span className="-my-1.5 flex flex-col overflow-hidden">
				{group.href ? (
					<BasicLink href={group.href} className="truncate label-md text-link hover:underline">
						{group.label}
					</BasicLink>
				) : (
					<span className="truncate label-md" title={group.label}>
						{group.label}
					</span>
				)}
				<span className="label-sm text-secondary">{formatAssetCount(group.metrics.assetCount)}</span>
			</span>
		</span>
	)
}

function LeafNameCell({ leaf, nested }: { leaf: RWALeafRow; nested: boolean }) {
	const { asset } = leaf
	return (
		<span className={`flex items-center gap-2 ${nested ? 'pl-12' : ''}`}>
			<span className="vf-row-index shrink-0" aria-hidden="true" />
			{asset.logo ? <TokenLogo src={asset.logo} size={24} alt={`${asset.assetName} logo`} /> : null}
			<span className="-my-1.5 flex flex-col overflow-hidden">
				<BasicLink href={asset.detailHref} className="truncate label-md text-link hover:underline">
					{asset.assetName}
				</BasicLink>
				<span className="label-sm text-secondary">{getSecondaryLabel(leaf)}</span>
			</span>
			{asset.suspicious ? (
				<RWASuspiciousWarning reason={asset.suspiciousReason} entity={asset.kind === 'perps' ? 'market' : 'asset'} />
			) : null}
		</span>
	)
}

function getSecondaryLabel(leaf: RWALeafRow): string {
	const label = leaf.asset.kind === 'perps' ? leaf.asset.contract : leaf.asset.ticker
	return leaf.chainScope ? `${label} on ${leaf.chainScope}` : label
}

function formatAssetCount(count: number): string {
	return count === 1 ? '1 asset' : `${count} assets`
}
