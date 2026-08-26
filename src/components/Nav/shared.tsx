import { BasicLink } from '~/components/Link'
import { ResearchIcon } from '~/components/ResearchIcon'
import { Icon } from '~/ui/Icon'
import type { IIcon } from '~/ui/Icon'

type NavIconName = IIcon['name']

export const navLinkStyles =
	'group/link -ml-1.5 flex flex-1 items-center gap-3 rounded-md p-1.5 cv-auto-30 text-primary hover:bg-hover-row focus-visible:bg-hover-row data-[linkactive=true]:bg-brand data-[linkactive=true]:text-on-brand data-[linkactive=true]:focus-visible:focus-ring-on-brand'

export const navSortableRowStyles =
	'group/link -ml-1.5 flex flex-1 items-start gap-3 rounded-md p-1.5 text-primary hover:bg-hover-row focus-visible:bg-hover-row'

export const navSummaryStyles =
	'-ml-1.5 flex items-center justify-between gap-3 rounded-md p-1.5 text-secondary hover:bg-hover-row focus-visible:bg-hover-row'

export const navActionStyles =
	'rounded-md px-2 py-1 label-sm tracking-wide text-secondary uppercase hover:bg-hover-row focus-visible:bg-hover-row'

export const freeTrialBadgeStyles =
	'hover-wash relative inline-flex shrink-0 items-center rounded-full border border-medium bg-surface-elevated-1 px-2 py-0.5 label-xs tracking-wide text-warning'

export function SidebarDivider({ className = '' }: { className?: string }) {
	return <hr className={`w-full max-w-53 border-t border-medium ${className}`} />
}

export function LinkToPage({
	route,
	name,
	icon,
	attention,
	freeTrial,
	isNew,
	asPath,
	umamiEvent,
	onClick,
	isOld
}: {
	route: string
	name: string
	icon?: NavIconName
	attention?: boolean
	freeTrial?: boolean
	isNew?: boolean
	asPath: string
	umamiEvent?: string
	onClick?: () => void
	isOld?: boolean
}) {
	const cleanAsPath = asPath.split('/?')[0].split('?')[0]
	const isActive = isOld ? route === cleanAsPath : cleanAsPath === route || cleanAsPath.startsWith(route + '/')
	const isExternal = route.startsWith('http')

	return (
		<BasicLink
			href={route}
			data-linkactive={isActive}
			data-umami-event={umamiEvent}
			target={isExternal ? '_blank' : undefined}
			rel={isExternal ? 'noopener noreferrer' : undefined}
			className={navLinkStyles}
			onClick={onClick}
		>
			<NavItemContent name={name} icon={icon} attention={attention} freeTrial={freeTrial} isNew={isNew} />
		</BasicLink>
	)
}

export function NavItemContent({
	name,
	icon,
	attention,
	freeTrial,
	isNew
}: {
	name: string
	icon?: NavIconName
	attention?: boolean
	freeTrial?: boolean
	isNew?: boolean
}) {
	return (
		<>
			{name === 'Universal Token Rating' ? (
				<svg
					viewBox="0 0 24 24"
					aria-hidden="true"
					className="size-4 shrink-0 text-utr-grade-on-color group-hover/link:animate-wiggle"
				>
					<clipPath id="utr-nav-tile">
						<rect width="24" height="24" rx="5" />
					</clipPath>
					<g clipPath="url(#utr-nav-tile)">
						<rect width="24" height="24" rx="5" className="fill-utr-grade-aaa" />
						<path
							d="M8 17 12 7l4 10M9.9 13.8h4.2"
							fill="none"
							stroke="currentColor"
							strokeWidth="2.2"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
						<path d="M8 -2h5L5 26H0Z" fill="currentColor" opacity="0.3" className="utr-nav-glint" />
					</g>
				</svg>
			) : icon ? (
				<Icon name={icon} className="size-4 shrink-0 group-hover/link:animate-wiggle" />
			) : name === 'LlamaAI' ? (
				<svg className="size-4 shrink-0 group-hover/link:animate-wiggle">
					<use href="/assets/llamaai/ask-llamaai-3.svg#ai-icon" />
				</svg>
			) : name === 'DefiLlama Research' ? (
				<ResearchIcon name="research-icon" className="size-4 shrink-0 group-hover/link:animate-wiggle" />
			) : null}
			<span className="relative flex min-w-0 flex-1 flex-nowrap items-center gap-2 text-left leading-tight">
				<span className="min-w-0 flex-1 truncate">{name}</span>
				{attention ? (
					<span aria-hidden className="inline-block size-2 shrink-0 rounded-full bg-data-down shadow-page-ring" />
				) : null}
				{freeTrial ? <span className={freeTrialBadgeStyles}>Try free</span> : null}
				{isNew ? (
					<span className="flex shrink-0 items-center gap-1 rounded-md bg-brand px-1.5 py-0.5 label-xs text-on-brand">
						<Icon name="sparkles" height={10} width={10} />
						<span>New</span>
					</span>
				) : null}
			</span>
		</>
	)
}
