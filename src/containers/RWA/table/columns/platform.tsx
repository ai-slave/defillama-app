import { Tag } from '~/ui/Tag'
import { TextLink } from '~/ui/TextLink'
import { Definition } from '~/ui/Tooltip'
import { getRwaPlatforms, UNKNOWN_PLATFORM } from '../../grouping'
import { perpsDefinitions } from '../../Perps/definitions'
import { getRwaPlatformHref } from '../classificationHrefs'
import { getPerpsMarket } from './perps'
import { columnHelper, DistinctListCell, textColumnMeta } from './shared'

const PLATFORM_HELP = 'Platform associated with issuance, custody, trading, or management of the asset.'

/**
 * The platform of an asset row, the venue of a perps row: one column for both trees, linking to the platform or venue
 * page. A perps group spanning several venues counts them, the names in the tooltip; an asset group lists its
 * platforms.
 */
function createPlatformColumn(kind: 'spot' | 'perps') {
	return columnHelper.accessor(
		(row) => {
			if (row.kind === 'group') return row.distinct.platform.join(', ')
			const platforms = getRwaPlatforms(row.asset.parentPlatform)
			return kind === 'perps' ? (getPerpsMarket(row)?.venue ?? platforms[0]) : platforms.join(', ')
		},
		{
			id: 'platform',
			header: kind === 'perps' ? 'Venue' : 'Platform',
			enableSorting: false,
			cell: ({ row }) => {
				const original = row.original
				if (original.kind === 'group') {
					const venues = original.distinct.platform
					if (kind === 'perps' && venues.length > 1) {
						return (
							<Definition content={venues.join(', ')} className="justify-end">
								{`${venues.length} venues`}
							</Definition>
						)
					}
					return <DistinctListCell values={venues} />
				}
				const platform = kind === 'perps' ? getPerpsMarket(original)?.venue : null
				const name = platform ?? getRwaPlatforms(original.asset.parentPlatform)[0]
				const venueType = getPerpsMarket(original)?.venueType
				return (
					<span className="flex items-center gap-1 overflow-hidden">
						{name === UNKNOWN_PLATFORM ? (
							<span className="truncate">{name}</span>
						) : (
							<TextLink href={getRwaPlatformHref(name, kind)} truncate>
								{name}
							</TextLink>
						)}
						{venueType ? <Tag className="shrink-0">{venueType}</Tag> : null}
					</span>
				)
			},
			meta:
				kind === 'perps'
					? textColumnMeta('w-[140px]', perpsDefinitions.venue.description, perpsDefinitions.venue.label)
					: textColumnMeta('w-[168px]', PLATFORM_HELP)
		}
	)
}

export const platformColumn = createPlatformColumn('spot')
export const venueColumn = createPlatformColumn('perps')
