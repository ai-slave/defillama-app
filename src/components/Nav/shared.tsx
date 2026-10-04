import { BasicLink } from '~/components/Link'
import { freeBadgeBOnly, useLlamaAIFreeLabel } from '~/components/LlamaAIFreeLabel'
import { ResearchIcon } from '~/components/ResearchIcon'
import { UniversalTokenRatingNavIcon } from '~/containers/UniversalTokenRating/NavIcon'
import { Icon } from '~/ui/Icon'
import type { IIcon } from '~/ui/Icon'
import { navPath } from './path'

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

function NavGroupSummary({ name, icon, onToggle }: { name: string; icon?: NavIconName; onToggle: () => void }) {
	return (
		<summary
			className={navLinkStyles}
			data-menu-name={name}
			onClick={(event) => {
				// Handle clicks immediately; native browser changes are reconciled by the details toggle handler.
				event.preventDefault()
				onToggle()
			}}
		>
			<NavItemContent name={name} icon={icon} wrapLabel />
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
	open,
	onToggle,
	alignLabels = false
}: {
	name: string
	route: string
	icon?: NavIconName
	pages: Array<{ name: string; route: string }>
	asPath: string
	open: boolean
	onToggle: () => void
	alignLabels?: boolean
}) {
	return (
		<details
			className="group"
			open={open}
			onToggle={(event) => {
				// Find-in-page can open a group without a click. Ignore toggles caused by React applying `open`.
				if (event.currentTarget.open !== open) onToggle()
			}}
		>
			<NavGroupSummary name={name} icon={icon} onToggle={onToggle} />
			<div
				className={
					alignLabels
						? 'relative pl-7 before:absolute before:inset-y-0 before:left-0 before:border-l before:border-subtle'
						: 'border-l border-subtle pl-2'
				}
			>
				{pages.map((page) => (
					<LinkToPage
						key={`${page.name}-${page.route}`}
						name={page.name}
						route={page.route}
						asPath={asPath}
						isOld={page.route === route && pages.some((sibling) => sibling.route.startsWith(`${route}/`))}
						hideIcon={alignLabels}
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
	isOld,
	hideIcon
}: {
	route: string
	name: string
	icon?: NavIconName
	attention?: boolean
	freeTrial?: boolean
	isNew?: boolean
	asPath: string
	umamiEvent?: string
	isOld?: boolean
	hideIcon?: boolean
}) {
	const isLlamaAI = name === 'LlamaAI'
	const freeLabel = useLlamaAIFreeLabel(isLlamaAI)
	const cleanAsPath = navPath(asPath)
	const isActive = isOld ? route === cleanAsPath : cleanAsPath === route || cleanAsPath.startsWith(`${route}/`)
	const isExternal = route.startsWith('http')

	return (
		<BasicLink
			href={route}
			data-linkactive={isActive}
			aria-current={isActive ? 'page' : undefined}
			data-umami-event={umamiEvent}
			target={isExternal ? '_blank' : undefined}
			rel={isExternal ? 'noopener noreferrer' : undefined}
			className={navLinkStyles}
			onClick={isLlamaAI ? freeLabel.trackEntryClick : undefined}
		>
			<NavItemContent
				name={name}
				icon={icon}
				attention={attention}
				freeTrial={freeTrial}
				freeLabel={isLlamaAI && freeLabel.showFree}
				isNew={isNew}
				hideIcon={hideIcon}
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
	isNew,
	hideIcon,
	wrapLabel
}: {
	name: string
	icon?: NavIconName
	attention?: boolean
	freeTrial?: boolean
	freeLabel?: boolean
	isNew?: boolean
	hideIcon?: boolean
	wrapLabel?: boolean
}) {
	return (
		<>
			{hideIcon ? null : name === 'Universal Token Rating' ? (
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
				<span className={wrapLabel ? 'min-w-0 flex-1' : 'min-w-0 flex-1 truncate'}>{name}</span>
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
