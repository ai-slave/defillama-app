import { Tooltip } from '~/ui/Tooltip'
import { definitions } from '../../definitions'
import type { RWAFlagKey, RWAFlagTally } from '../rows'
import { columnHelper, numberColumnMeta } from './shared'

type FlagKey = RWAFlagKey

/** yes over known; a child without an answer counts in neither. */
function FlagTallyCell({ tally, label }: { tally: RWAFlagTally; label: string }) {
	if (tally.known === 0) return null
	return (
		<Tooltip
			content={`${tally.yes} of ${tally.known} assets with a known ${label} value answer Yes.`}
			className="justify-end"
		>
			{tally.yes} / {tally.known}
		</Tooltip>
	)
}

function formatFlagTally(tally: RWAFlagTally): string {
	return tally.known === 0 ? '' : `${tally.yes}/${tally.known}`
}

type FlagColumnConfig = {
	key: FlagKey
	width: string
	/** A restriction: yes is the warning colour. */
	yesIsWarning?: boolean
	/** In the export, not the picker; the dialog filters cover them. */
	csvOnly?: boolean
}

const FLAG_COLUMNS: Array<FlagColumnConfig> = [
	{ key: 'redeemable', width: 'w-[120px]' },
	{ key: 'attestations', width: 'w-[120px]' },
	{ key: 'cexListed', width: 'w-[120px]', csvOnly: true },
	{ key: 'kycForMintRedeem', width: 'w-[min(188px,40vw)]', yesIsWarning: true, csvOnly: true },
	{ key: 'kycAllowlistedWhitelistedToTransferHold', width: 'w-[min(332px,40vw)]', yesIsWarning: true, csvOnly: true },
	{ key: 'transferable', width: 'w-[120px]', csvOnly: true },
	{ key: 'selfCustody', width: 'w-[120px]', csvOnly: true }
]

function createFlagColumn({ key, width, yesIsWarning = false, csvOnly = false }: FlagColumnConfig) {
	const definition = definitions[key]

	return columnHelper.accessor(
		(row) => (row.kind === 'group' ? formatFlagTally(row.flags[key]) : (row.asset[key] ?? undefined)),
		{
			id: key,
			header: definition.label,
			cell: ({ row, getValue }) => {
				if (row.original.kind === 'group')
					return <FlagTallyCell tally={row.original.flags[key]} label={definition.label} />
				const value = getValue()
				if (value == null || typeof value !== 'boolean') return null
				const isBad = yesIsWarning ? value : !value
				return (
					<span className={isBad ? (yesIsWarning ? 'text-warning' : 'text-data-down') : 'text-data-up'}>
						{value ? 'Yes' : 'No'}
					</span>
				)
			},
			meta: {
				...numberColumnMeta(width, definition.description),
				csvValue: (row) => (row.kind === 'group' ? formatFlagTally(row.flags[key]) : (row.asset[key] ?? '')),
				...(csvOnly ? { hidden: true, csvOnly: true } : {})
			}
		}
	)
}

export const flagColumns = FLAG_COLUMNS.map(createFlagColumn)
