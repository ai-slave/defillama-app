import { Button } from '~/ui/Button'
import { Icon, type IIcon } from '~/ui/Icon'
import { Logo } from '~/ui/Logo'
import { Tooltip } from '~/ui/Tooltip'

/* ----------------------------------------------------------------------------
   IrHeaderLinks — the link row at the right of an investor dashboard's
   header: the partner's own pages (website, docs, X, explorer) as quiet
   ghost links with sprite icons, then its call to action in the partner's
   colors. A link to another protocol shows that protocol's logo instead.

   Below lg a link shows only its icon, named by its screen-reader label and
   a Tooltip. Every link stays on a phone: the header around the row wraps
   (`flex flex-wrap`), so when the icons do not fit beside the partner's
   mark the row drops to its own line, still pushed right by `ml-auto`.
   Every link opens in a new tab. A link whose URL comes from metadata that
   has not loaded (or lacks it) has no `href` and is left out.
---------------------------------------------------------------------------- */

export type IrHeaderLink = { label: string; href: string | undefined } & ({ icon: IIcon['name'] } | { logo: string })

export function IrHeaderLinks({
	links,
	launch
}: {
	links: ReadonlyArray<IrHeaderLink>
	/** The partner's call to action on its brand fill (a gradient); `darkLabel` for a fill too light for white text. */
	launch?: { label: string; href: string; background: string; darkLabel?: boolean }
}) {
	const shown = links.filter((link) => link.href)
	return (
		<nav className="ml-auto flex items-center gap-0.5">
			{shown.map((link) => (
				<Tooltip
					key={link.label}
					content={link.label}
					render={
						<Button as="a" variant="ghost" size="md" href={link.href} target="_blank" rel="noopener noreferrer" />
					}
				>
					{'icon' in link ? <Icon name={link.icon} className="size-3.5" /> : <Logo src={link.logo} size={14} />}
					<span className="max-lg:sr-only">{link.label}</span>
				</Tooltip>
			))}
			{launch ? (
				<a
					href={launch.href}
					target="_blank"
					rel="noopener noreferrer"
					className={`ml-1 flex items-center gap-1.5 rounded-full px-4 py-1.5 title-md transition-[filter] hover:brightness-110 ${launch.darkLabel ? 'text-black' : 'text-on-brand'}`}
					style={{ background: launch.background }}
				>
					{launch.label}
					<Icon name="arrow-up-right" className="size-3.5" />
				</a>
			) : null}
		</nav>
	)
}
