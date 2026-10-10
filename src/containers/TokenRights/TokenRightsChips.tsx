import { type Status, StatusBadge } from '~/ui/StatusBadge'
import { Tag } from '~/ui/Tag'

export function feeSwitchBadgeStatus(value: string): Status {
	switch (value) {
		case 'ON':
			return 'good'
		case 'PENDING':
			return 'caution'
		case 'OFF':
			return 'bad'
		default:
			return 'neutral'
	}
}

/** Yes means an equity entity takes revenue that could flow to token holders, so it is the bad answer. */
export function equityCaptureBadgeStatus(value: string): Status {
	switch (value) {
		case 'Yes':
			return 'bad'
		case 'Partial':
			return 'caution'
		case 'No':
			return 'good'
		default:
			return 'neutral'
	}
}

export function TokenRightsTagList({ items }: { items: Array<string> }) {
	return (
		// A span, so the list can also sit inside a heading.
		<span className="flex flex-wrap items-center gap-1.5">
			{items.map((item, index) => (
				// oxlint-disable-next-line react/no-array-index-key -- These read-only labels preserve repeated occurrences from authored text.
				<Tag key={`${item}-${index}`}>{item}</Tag>
			))}
		</span>
	)
}

type TokenRightsChipVariant = 'overview' | 'details'

/** The tokens that hold a right: held is the good answer, against the N/A of a right nobody holds. The overview row
    stays on one line; the details row wraps. */
export function TokenRightsChipList({ items, variant }: { items: Array<string>; variant: TokenRightsChipVariant }) {
	return (
		<span className={`flex items-center gap-1.5 ${variant === 'details' ? 'flex-wrap' : 'flex-nowrap'}`}>
			{items.map((item, index) => (
				// oxlint-disable-next-line react/no-array-index-key -- These read-only labels preserve repeated occurrences from authored text.
				<StatusBadge key={`${item}-${index}`} status="good">
					{item}
				</StatusBadge>
			))}
		</span>
	)
}
