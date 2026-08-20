import type { ArticleImage } from '~/containers/Articles/types'

/**
 * Pill overlaid on a report cover. Colors are fixed (not theme tokens):
 * the pill sits on arbitrary cover art, so it must stay dark with white
 * text in both light and dark mode. Sponsor logos are editorial uploads
 * and must be a variant that reads on a dark background.
 */
export function SponsoredByBadge({ sponsorLogo }: { sponsorLogo: ArticleImage }) {
	return (
		<div className="pointer-events-none absolute right-[12px] bottom-[12px] flex items-center gap-2 rounded-full bg-research-backdrop-soft px-2 py-1 text-research-white backdrop-blur-sm">
			<span className="font-jetbrains text-[8px] tracking-[0.16em] uppercase opacity-80">Sponsored by</span>
			<img
				src={sponsorLogo.url}
				alt={sponsorLogo.alt || 'Sponsor logo'}
				className="h-5 w-auto max-w-[80px] object-contain"
			/>
		</div>
	)
}
