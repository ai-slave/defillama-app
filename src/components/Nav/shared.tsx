import type * as React from 'react'
import { BasicLink } from '~/components/Link'
import { freeBadgeBOnly, useLlamaAIFreeLabel } from '~/components/LlamaAIFreeLabel'
import { setStorageItem, useStorageItem } from '~/contexts/localStorageStore'
import { Icon } from '~/ui/Icon'
import type { IIcon } from '~/ui/Icon'
import { PromoBadge } from '~/ui/PromoBadge'
import { navPath } from './path'

export const navLinkStyles =
	'group/link -ml-1.5 flex flex-1 items-center gap-3 rounded-md p-1.5 cv-auto-30 text-primary hover:bg-hover-row focus-visible:bg-hover-row not-data-[linkactive=true]:active:bg-pressed-row data-[linkactive=true]:bg-brand data-[linkactive=true]:text-on-brand data-[linkactive=true]:focus-visible:focus-ring-on-brand'

export const navSortableRowStyles =
	'group/link -ml-1.5 flex flex-1 items-start gap-3 rounded-md p-1.5 text-primary hover:bg-hover-row focus-visible:bg-hover-row active:bg-pressed-row'

export const navSummaryStyles =
	'-ml-1.5 flex items-center justify-between gap-3 rounded-md p-1.5 text-secondary hover:bg-hover-row focus-visible:bg-hover-row active:bg-pressed-row'

function NavGroupSummary({ name, icon, onToggle }: { name: string; icon?: IIcon['name']; onToggle: () => void }) {
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

const DASHBOARDS_COLLAPSED_KEY = 'nav-dashboards-collapsed'

// Page layouts remount the nav on every navigation, so a collapsed Your Dashboards section is stored, shared by the
// desktop sidebar and the phone menu. The server renders it open; a stored collapse closes it after hydration.
export function useDashboardsDisclosure() {
	const open = useStorageItem(DASHBOARDS_COLLAPSED_KEY, null) !== 'true'
	// Also fires when the stored state changes `open`; setStorageItem skips that unchanged write.
	const onToggle = (event: React.SyntheticEvent<HTMLDetailsElement>) =>
		setStorageItem(DASHBOARDS_COLLAPSED_KEY, String(!event.currentTarget.open))
	return { open, onToggle }
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
	icon?: IIcon['name']
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
						exactMatch={page.route === route && pages.some((sibling) => sibling.route.startsWith(`${route}/`))}
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
	isNew,
	asPath,
	umamiEvent,
	exactMatch,
	hideIcon
}: {
	route: string
	name: string
	icon?: IIcon['name']
	attention?: boolean
	isNew?: boolean
	asPath: string
	umamiEvent?: string
	exactMatch?: boolean
	hideIcon?: boolean
}) {
	const isLlamaAI = name === 'LlamaAI'
	const freeLabel = useLlamaAIFreeLabel(isLlamaAI)
	const cleanAsPath = navPath(asPath)
	const isActive = exactMatch ? route === cleanAsPath : cleanAsPath === route || cleanAsPath.startsWith(`${route}/`)
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
	freeLabel,
	isNew,
	hideIcon,
	wrapLabel
}: {
	name: string
	icon?: IIcon['name']
	attention?: boolean
	freeLabel?: boolean
	isNew?: boolean
	hideIcon?: boolean
	wrapLabel?: boolean
}) {
	return (
		<>
			{icon && !hideIcon ? <Icon name={icon} className="size-4 shrink-0 group-hover/link:animate-wiggle" /> : null}
			<span className="relative flex min-w-0 flex-1 flex-nowrap items-center gap-2 text-left leading-tight">
				<span className={wrapLabel ? 'min-w-0 flex-1' : 'min-w-0 flex-1 truncate'}>{name}</span>
				{attention ? (
					<span aria-hidden className="inline-block size-2 shrink-0 rounded-full bg-error shadow-page-ring" />
				) : null}
				{freeLabel ? <PromoBadge className={freeBadgeBOnly}>Free</PromoBadge> : null}
				{isNew ? <PromoBadge icon="sparkles">New</PromoBadge> : null}
			</span>
		</>
	)
}
