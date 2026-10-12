import { Tooltip } from '~/ui/Tooltip'
import { definitions } from '../../definitions'
import type { RWAFlagKey, RWAFlagTally } from '../rows'
import { columnHelper, numberColumnMeta } from './shared'

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
	key: RWAFlagKey
	width?: string
	/** A restriction: yes is the warning color. */
	yesIsWarning?: boolean
	/** In the export, not the picker; the dialog filters cover them. */
	csvOnly?: boolean
}

const FLAG_COLUMNS: Array<FlagColumnConfig> = [
	{ key: 'redeemable' },
	{ key: 'attestations' },
	{ key: 'cexListed', width: 'min-w-[120px]', csvOnly: true },
	{ key: 'kycForMintRedeem', yesIsWarning: true, csvOnly: true },
	{ key: 'kycAllowlistedWhitelistedToTransferHold', yesIsWarning: true, csvOnly: true },
	{ key: 'transferable', csvOnly: true },
	{ key: 'selfCustody', csvOnly: true }
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
					<span className={isBad ? (yesIsWarning ? 'text-warning' : 'text-error') : 'text-success'}>
						{value ? 'Yes' : 'No'}
					</span>
				)
			},
			meta: {
				headerClassName: width,
				...numberColumnMeta(definition.description),
				csvValue: (row) => (row.kind === 'group' ? formatFlagTally(row.flags[key]) : (row.asset[key] ?? '')),
				...(csvOnly ? { hidden: true, csvOnly: true } : {})
			}
		}
	)
}

export const flagColumns = FLAG_COLUMNS.map(createFlagColumn)
/** The Compliance set shows six flags in the reader's order: proof first, then the gates, then the exits. CEX
    listing is known on a third of the assets and reads Yes wherever known, so it stays csv-only. */
const COMPLIANCE_FLAG_ORDER: ReadonlyArray<RWAFlagKey> = [
	'attestations',
	'kycForMintRedeem',
	'kycAllowlistedWhitelistedToTransferHold',
	'transferable',
	'selfCustody',
	'redeemable'
]
export const pickerFlagColumns = COMPLIANCE_FLAG_ORDER.map((key) => {
	const column = FLAG_COLUMNS.find((candidate) => candidate.key === key)
	if (!column) throw new Error(`flag column ${key} is not configured`)
	return createFlagColumn({ ...column, csvOnly: false })
})
