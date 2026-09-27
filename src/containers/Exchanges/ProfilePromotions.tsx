import { ExternalLinkButton } from '~/components/ExternalLinkButton'
import { Card } from '~/ui/Card'
import { Icon } from '~/ui/Icon'
import { Tag } from '~/ui/Tag'
import { keyedOccurrences } from '~/utils/keyedOccurrences'
import type { ExchangeProfileModel } from './models'
import { activePromotions, promotionLinks } from './promotions'

export function ProfilePromotions({
	promotions,
	asOfDate
}: {
	promotions: ExchangeProfileModel['metadata']['promotions']
	asOfDate: string
}) {
	const active = activePromotions(promotions, asOfDate)
	if (active.length === 0) return null
	return (
		<Card as="section" padding="none" aria-label="Exchange promotions" className="overflow-hidden">
			{keyedOccurrences(active, (promotion) =>
				JSON.stringify([promotion.url, promotion.sourceUrl, promotion.startsAt])
			).map(({ item: promotion, key }) => {
				const links = promotionLinks(promotion)
				return (
					<div key={key} className="flex flex-wrap items-center gap-2 border-b border-subtle p-2 last:border-b-0">
						<span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-medium text-link">
							<Icon name="gift" className="size-4" />
						</span>
						<div className="min-w-0 flex-1">
							<div className="flex flex-wrap items-center gap-2">
								<h2 className="label-md">{promotion.title}</h2>
								<Tag>{promotion.label}</Tag>
								{promotion.endsAt ? <span className="body-sm text-tertiary">Ends {promotion.endsAt}</span> : null}
							</div>
							{promotion.subtitle ? <p className="body-sm text-secondary">{promotion.subtitle}</p> : null}
						</div>
						<div className="flex flex-wrap items-center gap-2">
							{links.map((link) => (
								<ExternalLinkButton key={`${link.label}:${link.href}`} href={link.href}>
									{link.label === 'Campaign page' ? 'View offer' : link.label}
								</ExternalLinkButton>
							))}
						</div>
					</div>
				)
			})}
		</Card>
	)
}
