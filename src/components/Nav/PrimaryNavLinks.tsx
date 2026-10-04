import { MENU_VARIANT_B } from './menuVariant'
import { LinkToPage, PrimaryNavGroup } from './shared'
import type { TNavLink } from './types'

/** Both variants are server-rendered; the existing pre-paint A/B attribute selects one without a layout flash. */
export function PrimaryNavLinks({ pages, asPath }: { pages: Array<TNavLink>; asPath: string }) {
	return (
		<>
			<NavItems pages={pages} asPath={asPath} variant="a" />
			<NavItems pages={MENU_VARIANT_B} asPath={asPath} variant="b" />
		</>
	)
}

export function NavItems({ pages, asPath, variant }: { pages: Array<TNavLink>; asPath: string; variant?: 'a' | 'b' }) {
	return (
		<div className="flex flex-col" data-ab-variant={variant}>
			{pages.map(({ children, ...page }) =>
				children ? (
					<PrimaryNavGroup
						key={`${page.name}-${page.route}`}
						{...page}
						pages={children}
						asPath={asPath}
						defaultOpen={variant !== 'b' && !(variant === 'a' && page.route === '/equities')}
						alignLabels={variant === 'b' || (variant === 'a' && page.route === '/equities')}
					/>
				) : (
					<LinkToPage key={`${page.name}-${page.route}`} {...page} asPath={asPath} />
				)
			)}
		</div>
	)
}
