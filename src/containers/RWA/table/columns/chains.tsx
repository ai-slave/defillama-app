import { IconsRow, type IconsRowItem } from '~/components/IconsRow'
import { formatPercent } from '~/utils/numberFormat'
import { rwaSlug } from '../../rwaSlug'
import type { RWAChainShare } from '../chains'
import { columnHelper } from './shared'

export const CHAINS_COLUMN_HELP = 'Chains the asset has onchain AUM on, largest first.'

export const chainsColumn = columnHelper.accessor((row) => row.metrics.chains.map((share) => share.chain).join(', '), {
	id: 'chains',
	header: 'Chains',
	enableSorting: false,
	cell: ({ row }) => {
		const chains = row.original.metrics.chains
		return chains.length === 0 ? null : <IconsRow items={chains.map(toChainIconItem)} />
	},
	meta: { headerClassName: 'min-w-[160px]', align: 'end', headerHelperText: CHAINS_COLUMN_HELP }
})

function toChainIconItem(share: RWAChainShare): IconsRowItem {
	return {
		label: share.chain,
		kind: 'chain',
		href: `/rwa/chain/${rwaSlug(share.chain)}`,
		title: `${share.chain} ${formatPercent(share.share, { input: 'fraction' })}`,
		size: 22
	}
}
