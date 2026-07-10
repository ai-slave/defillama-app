import { ExternalLinkButton } from '~/components/ExternalLinkButton'
import { BasicLink } from '~/components/Link'
import { Menu } from '~/components/Menu'
import { QuestionHelper } from '~/components/QuestionHelper'
import { buttonStyles } from '~/ui/Button'
import { slug } from '~/utils'

export function ProtocolInformationCard({
	category,
	projectName,
	projectSlug,
	config,
	url,
	assetTokens
}: {
	category: string
	projectName: string
	projectSlug: string
	config: any
	url: string
	assetTokens?: string[]
}) {
	return (
		<div className="flex flex-col gap-2 rounded-md border border-(--legacy-cards-border) bg-(--legacy-cards-bg) p-2 xl:p-4">
			<h3 className="text-base font-semibold">Information</h3>
			{projectName && projectSlug ? (
				<p className="flex items-center gap-1">
					<span>Protocol:</span>
					<BasicLink href={`/protocol/${projectSlug}`} className="hover:underline">
						{projectName}
					</BasicLink>
				</p>
			) : null}
			<p className="flex items-center gap-1">
				<span>Category:</span>
				<BasicLink href={`/protocols/${slug(category)}`} className="hover:underline">
					{category}
				</BasicLink>
			</p>

			{assetTokens?.length ? (
				<p className="flex flex-wrap items-center gap-1">
					<span>Assets:</span>
					{assetTokens.map((asset, index) => (
						<span key={asset} className="inline-flex items-center gap-1">
							<BasicLink href={`/token/${encodeURIComponent(asset)}`} className="hover:underline">
								{asset.toUpperCase()}
							</BasicLink>
							{index < assetTokens.length - 1 ? <span>,</span> : null}
						</span>
					))}
				</p>
			) : null}

			{config?.audits ? (
				<>
					<p className="flex items-center gap-1">
						<span className="flex flex-nowrap items-center gap-1">
							<span>Audits</span>
							<QuestionHelper text="Audits are not a security guarantee" />
							<span>:</span>
						</span>
						{config.audit_links?.length > 0 ? (
							<Menu
								name="Yes"
								options={config.audit_links}
								isExternal
								className={buttonStyles({ size: 'md' })}
								popoverVariant="legacy"
							/>
						) : (
							<span>No</span>
						)}
					</p>
					{config.audit_note ? <p>Audit Note: {config.audit_note}</p> : null}
				</>
			) : null}
			<div className="flex flex-wrap gap-2">
				{url ? (
					<ExternalLinkButton href={url} icon="globe">
						Website
					</ExternalLinkButton>
				) : null}
				{config?.github?.length
					? config.github.map((github) => (
							<ExternalLinkButton
								href={`https://github.com/${github}`}
								icon="github"
								key={`${config.name}-github-${github}`}
							>
								{config.github.length === 1 ? 'GitHub' : github}
							</ExternalLinkButton>
						))
					: null}
				{config?.twitter ? (
					<ExternalLinkButton href={`https://x.com/${config.twitter}`} icon="twitter">
						Twitter
					</ExternalLinkButton>
				) : null}
			</div>
		</div>
	)
}
