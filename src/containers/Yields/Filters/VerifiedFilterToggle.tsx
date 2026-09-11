import { useRouter } from 'next/router'
import { Button } from '~/ui/Button'
import { Tooltip } from '~/ui/Tooltip'
import { trackYieldsEvent, YIELDS_EVENTS } from '~/utils/analytics/yields'
import { pushYieldsQuery } from '../queryUpdates.client'
import { MeasuredLock, SealGlyph } from '../Tables/Measured'
import { useVerifiedAccess } from '../useVerifiedAccess'
import { ATTRIBUTE_DEFS } from './attributeOptions'

const { key, help } = ATTRIBUTE_DEFS.verified

// Reads and writes the same `attribute` param as the Attributes dropdown, so the two never disagree.
export function VerifiedFilterToggle() {
	const router = useRouter()
	const { hasAccess: unlocked } = useVerifiedAccess()
	const { attribute } = router.query
	const attributes = Array.isArray(attribute) ? attribute : attribute == null ? [] : [attribute]
	const active = attributes.includes(key)

	const toggle = () => {
		if (!active) trackYieldsEvent(YIELDS_EVENTS.FILTER_ATTRIBUTE, { attribute: key })
		const next = active ? attributes.filter((value) => value !== key) : [...attributes, key]
		void pushYieldsQuery(router, { attribute: next.length > 0 ? next : undefined })
	}

	return (
		<Tooltip content={help}>
			<Button type="button" variant="toggle" size="md" aria-pressed={active} data-active={active} onClick={toggle}>
				{unlocked ? (
					<SealGlyph size={13} className="text-current" />
				) : (
					<MeasuredLock tone="inherit" label="Verified APY is available on a Pro subscription" />
				)}
				Verified
			</Button>
		</Tooltip>
	)
}
