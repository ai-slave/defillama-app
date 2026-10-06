import { ExternalLinkButton } from '~/components/ExternalLinkButton'
import { BasicLink } from '~/components/Link'
import { Menu } from '~/components/Menu'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { Tooltip } from '~/ui/Tooltip'
import type { RWAPlatformKpi } from '../../kpi/platformKpi'
import type { RWAPlatformMeta } from '../api.types'
import { getRwaPlatformLinks, getRwaPlatformTags, rankRwaPlatformIssuers } from './panelData'
import { PanelCard, Pill, Pills, Prose } from './PanelParts'

/** What the platform is: the description, its tags, where to find it, and the issuers it hosts. Always rendered. */
export function AboutPanel({ meta, kpi }: { meta: RWAPlatformMeta; kpi: RWAPlatformKpi }) {
	const tags = getRwaPlatformTags(meta)
	const links = getRwaPlatformLinks(meta)
	const issuers = rankRwaPlatformIssuers(kpi.issuersByMcap)
	const hasLinks =
		links.websites.length > 0 || links.docs != null || links.protocolHref != null || links.socials.length > 0

	return (
		<PanelCard title={`About ${meta.name}`}>
			{meta.description ? <Prose>{meta.description}</Prose> : null}
			<Pills items={tags} />
			{hasLinks ? (
				<div className="flex flex-wrap items-center gap-1.5">
					{links.websites.length > 1 ? (
						<Menu name="Website" options={links.websites} isExternal />
					) : links.websites[0] ? (
						<ExternalLinkButton href={links.websites[0]} icon="globe">
							Website
						</ExternalLinkButton>
					) : null}
					{links.docs ? (
						<ExternalLinkButton href={links.docs} icon="file-text">
							Docs
						</ExternalLinkButton>
					) : null}
					{links.protocolHref ? (
						<Button as={BasicLink} href={links.protocolHref} size="md">
							<span>Protocol page</span>
						</Button>
					) : null}
					{links.socials.length > 0 ? (
						<span className="mx-1 h-6 w-px bg-surface-elevated-2" aria-hidden="true" />
					) : null}
					{links.socials.map((social) => (
						<Tooltip
							key={social.label}
							content={social.label}
							render={<Button as="a" href={social.href} target="_blank" rel="noopener noreferrer" size="md" square />}
						>
							<Icon name={social.icon} className="size-4" />
							<span className="sr-only">{social.label}</span>
						</Tooltip>
					))}
				</div>
			) : null}
			{issuers.shown.length > 0 ? (
				<div className="flex flex-wrap items-center gap-1.5">
					<span className="label-md text-secondary">Issuers on the platform:</span>
					{issuers.shown.map((issuer) => (
						<Pill key={issuer}>{issuer}</Pill>
					))}
					{issuers.more > 0 ? <Pill>+{issuers.more} more</Pill> : null}
				</div>
			) : null}
		</PanelCard>
	)
}
