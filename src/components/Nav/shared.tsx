import { useState } from 'react'
import { BasicLink } from '~/components/Link'
import { freeBadgeBOnly, useLlamaAIFreeLabel } from '~/components/LlamaAIFreeLabel'
import { ResearchIcon } from '~/components/ResearchIcon'
import { UniversalTokenRatingNavIcon } from '~/containers/UniversalTokenRating/NavIcon'
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

function NavGroupSummary({ name, icon }: { name: string; icon?: NavIconName }) {
	return (
		<summary className={navLinkStyles}>
			<NavItemContent name={name} icon={icon} />
			<Icon name="chevron-down" className="size-4 shrink-0 text-tertiary group-open:rotate-180" />
		</summary>
	)
}

export function PrimaryNavGroup({
	name,
	route,
	icon,
	pages,
	asPath,
	onClick
}: {
	name: string
	route: string
	icon?: NavIconName
	pages: Array<{ name: string; route: string }>
	asPath: string
	onClick?: () => void
}) {
	const [open, setOpen] = useState(true)
	return (
		<details className="group" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
			<NavGroupSummary name={name} icon={icon} />
			<div className="border-l border-subtle pl-2">
				{pages.map((page) => (
					<LinkToPage
						key={`${page.name}-${page.route}`}
						name={page.name}
						route={page.route}
						asPath={asPath}
						onClick={onClick}
						isOld={page.route === route}
					/>
				))}
			</div>
		</details>
	)
}

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
	const isLlamaAI = name === 'LlamaAI'
	const freeLabel = useLlamaAIFreeLabel(isLlamaAI)
	const cleanAsPath = asPath.split('/?')[0].split('?')[0]
	const isActive = isOld ? route === cleanAsPath : cleanAsPath === route || cleanAsPath.startsWith(`${route}/`)
	const isExternal = route.startsWith('http')

	return (
		<BasicLink
			href={route}
			data-linkactive={isActive}
			data-umami-event={umamiEvent}
			target={isExternal ? '_blank' : undefined}
			rel={isExternal ? 'noopener noreferrer' : undefined}
			className={navLinkStyles}
			onClick={
				isLlamaAI
					? () => {
							freeLabel.trackEntryClick()
							onClick?.()
						}
					: onClick
			}
		>
			<NavItemContent
				name={name}
				icon={icon}
				attention={attention}
				freeTrial={freeTrial}
				freeLabel={isLlamaAI && freeLabel.showFree}
				isNew={isNew}
			/>
		</BasicLink>
	)
}

export function NavItemContent({
	name,
	icon,
	attention,
	freeTrial,
	freeLabel,
	isNew
}: {
	name: string
	icon?: NavIconName
	attention?: boolean
	freeTrial?: boolean
	freeLabel?: boolean
	isNew?: boolean
}) {
	return (
		<>
			{name === 'Universal Token Rating' ? (
				<UniversalTokenRatingNavIcon />
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
				{freeLabel ? <span className={freeBadgeBOnly}>Free</span> : null}
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
