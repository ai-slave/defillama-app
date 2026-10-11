import { TokenLogo } from '~/components/TokenLogo'
import { Icon } from '~/ui/Icon'
import { Logo } from '~/ui/Logo'
import { Tag } from '~/ui/Tag'
import { TextLink } from '~/ui/TextLink'
import { Tooltip } from '~/ui/Tooltip'
import { RWASuspiciousWarning } from '../../SuspiciousWarning'
import type { RWAGroupRow, RWALeafRow } from '../rows'
import { getVenueGroupTypes } from './perps'
import { columnHelper } from './shared'

/** The row's name; `assetLine` off drops the reference asset under a market's contract, for the asset's own page. */
export function createNameColumn({ assetLine = true }: { assetLine?: boolean } = {}) {
	return columnHelper.accessor(
		(row) =>
			row.kind === 'group'
				? row.label
				: row.asset.kind === 'perps'
					? row.asset.contract
					: row.asset.assetName || row.asset.ticker,
		{
			id: 'name',
			enableHiding: false,
			header: 'Name',
			enableSorting: false,
			/* The row state is read here, in the cell function, and handed down as values: a component that read
			   `row.getIsExpanded()` itself would be memoized on the row's stable identity and freeze. */
			cell: ({ row }) =>
				row.original.kind === 'group' ? (
					<GroupNameCell
						group={row.original}
						expanded={row.getIsExpanded()}
						onToggle={row.getToggleExpandedHandler()}
					/>
				) : (
					<LeafNameCell leaf={row.original} nested={row.depth > 0} assetLine={assetLine} />
				),
			meta: { headerClassName: 'w-[200px] sm:w-[260px]' }
		}
	)
}

export const nameColumn = createNameColumn()

function GroupNameCell({ group, expanded, onToggle }: { group: RWAGroupRow; expanded: boolean; onToggle: () => void }) {
	return (
		<span className="relative flex items-center gap-2 pl-6">
			<button type="button" className="absolute -left-0.5" aria-expanded={expanded} onClick={onToggle}>
				<Icon name={expanded ? 'chevron-down' : 'chevron-right'} className="size-4 text-tertiary" />
				<span className="sr-only">
					{expanded ? 'Hide' : 'Show'} {group.children[0]?.asset.kind === 'perps' ? 'markets' : 'assets'}
				</span>
			</button>
			<span className="vf-row-index shrink-0" aria-hidden="true" />
			{group.icon?.kind === 'chain' ? (
				<TokenLogo name={group.icon.name} kind="chain" size={24} alt={`Logo of ${group.label}`} />
			) : group.icon?.kind === 'src' ? (
				<Logo src={group.icon.src} size={24} alt={`Logo of ${group.label}`} />
			) : null}
			{/* -my-2, not the leaf's -my-1.5: the venue type's Tag makes the second line 22px, and the column still fits
			   the 50px row the virtualized table places rows by. */}
			<span className="-my-2 flex flex-col overflow-hidden">
				{group.href ? (
					<TextLink href={group.href} truncate>
						{group.label}
					</TextLink>
				) : (
					<Tooltip content={group.label} render={<span className="truncate label-md" />}>
						{group.label}
					</Tooltip>
				)}
				{/* The venue type sits beside the count, not the name, so a phone keeps the row on two lines. */}
				<span className="flex items-center gap-1 label-sm text-secondary">
					{formatMemberCount(group.metrics.assetCount, group.children[0]?.asset.kind === 'perps')}
					{getVenueGroupTypes(group).map((type) => (
						<Tag key={type} className="shrink-0">
							{type}
						</Tag>
					))}
				</span>
			</span>
		</span>
	)
}

/** A market reads by its contract with its asset under it; pair and venue type are columns of their own. */
function LeafNameCell({ leaf, nested, assetLine }: { leaf: RWALeafRow; nested: boolean; assetLine: boolean }) {
	const { asset } = leaf
	const label = asset.kind === 'perps' ? asset.contract : asset.assetName
	return (
		<span className={`flex items-center gap-2 ${nested ? 'pl-12' : ''}`}>
			<span className="vf-row-index shrink-0" aria-hidden="true" />
			{asset.logo ? <Logo src={asset.logo} size={24} alt={`${asset.assetName} logo`} /> : null}
			<span className="-my-1.5 flex flex-col overflow-hidden">
				<TextLink href={asset.detailHref} truncate>
					{label}
				</TextLink>
				{/* One line, like the title above: the virtualized table places rows by a fixed height, so a wrapped name
				   (a perps market's full asset name) pushes the rows around it while scrolling. */}
				{assetLine || asset.kind !== 'perps' ? (
					<Tooltip content={getSecondaryLabel(leaf)} render={<span className="truncate label-sm text-secondary" />}>
						{getSecondaryLabel(leaf)}
					</Tooltip>
				) : null}
			</span>
			{asset.suspicious ? (
				<RWASuspiciousWarning reason={asset.suspiciousReason} entity={asset.kind === 'perps' ? 'market' : 'asset'} />
			) : null}
		</span>
	)
}

function getSecondaryLabel(leaf: RWALeafRow): string {
	const label = leaf.asset.kind === 'perps' ? leaf.asset.assetName : leaf.asset.ticker
	return leaf.chainScope ? `${label} on ${leaf.chainScope}` : label
}

/** A perps group counts markets, a spot group counts assets. */
function formatMemberCount(count: number, perps: boolean): string {
	const noun = perps ? 'market' : 'asset'
	return count === 1 ? `1 ${noun}` : `${count} ${noun}s`
}
