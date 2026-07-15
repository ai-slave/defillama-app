import type { Banner } from '~/containers/Articles/types'

export function PromoDisclosure({ banner }: { banner: Banner }) {
	const disclosureUrl = banner.disclosureUrl?.trim()
	if (!disclosureUrl) return null

	return (
		<div className="pl-1">
			<a
				href={disclosureUrl}
				target="_blank"
				rel="noopener noreferrer"
				className="text-xs leading-none font-bold text-(--legacy-text-tertiary) transition-colors hover:text-(--legacy-text-primary) hover:underline"
			>
				{banner.disclosureText?.trim() || 'Disclosure'}
			</a>
		</div>
	)
}
