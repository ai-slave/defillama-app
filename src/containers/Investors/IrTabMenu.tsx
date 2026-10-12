import * as Ariakit from '@ariakit/react'
import { BasicLink } from '~/components/Link'
import { TokenLogo } from '~/components/TokenLogo'
import { Icon } from '~/ui/Icon'
import { IconTile } from '~/ui/IconTile'
import { MenuSurface } from '~/ui/PopoverSurface'
import { TabLink } from '~/ui/Tabs'
import { IrTabLabel } from './IrTabLabel'
import { getIrTabMenuItems, type MainSiteIrDashboard } from './mainSiteDashboards'

const menuItemStyles =
	'group relative flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 hover:bg-hover-row focus-visible:bg-hover-row data-active-item:bg-hover-row data-focus-visible:focus-ring data-[active=true]:bg-hover-row'

export function IrTabMenu({
	dashboard,
	active,
	activeTabId
}: {
	dashboard: Extract<MainSiteIrDashboard, { tabPlacement: 'menu' }>
	active: boolean
	activeTabId?: string
}) {
	const umamiProps = {
		'data-umami-event': 'investor-relations-tab-click',
		'data-umami-event-entity-type': dashboard.entityType,
		'data-umami-event-entity': dashboard.slug,
		'data-umami-event-dashboard-id': dashboard.dashboardId
	}

	return (
		<Ariakit.MenuProvider>
			<Ariakit.MenuButton
				render={<TabLink as="button" type="button" className="group" />}
				aria-current={active ? 'page' : undefined}
				{...umamiProps}
			>
				<IrTabLabel
					label={dashboard.tabLabel}
					gradient={dashboard.brandGradient}
					active={active}
					trailing={
						<Icon
							name="chevron-down"
							className="size-3.5 shrink-0 text-tertiary transition-transform group-aria-expanded:rotate-180"
						/>
					}
				/>
			</Ariakit.MenuButton>
			<MenuSurface variant="actions" width="lg">
				<div className="flex items-center gap-3 border-b border-subtle px-4 py-3">
					<TokenLogo name={dashboard.entityName} kind="token" size={28} alt={`Logo of ${dashboard.entityName}`} />
					<div className="flex min-w-0 flex-col">
						<span className="label-md text-primary">
							{dashboard.entityName} {dashboard.tabLabel}
						</span>
						<span className="truncate label-xs text-tertiary">{dashboard.menuTagline}</span>
					</div>
				</div>
				<div className="flex flex-col gap-0.5 p-1.5">
					{getIrTabMenuItems(dashboard, active, activeTabId).map((tab) => {
						const isActive = tab.isActive
						return (
							<Ariakit.MenuItem
								key={tab.id}
								render={<BasicLink href={tab.href} />}
								data-active={isActive}
								aria-current={isActive ? 'page' : undefined}
								className={menuItemStyles}
								{...umamiProps}
								data-umami-event-ir-tab={tab.id}
							>
								<IconTile icon={tab.icon ?? 'layers'} tone={isActive ? 'brand' : 'neutral'} size="sm" />
								<span className="flex min-w-0 flex-col">
									<span className="label-sm text-primary">{tab.label}</span>
									{tab.description ? <span className="truncate label-xs text-tertiary">{tab.description}</span> : null}
								</span>
								{isActive ? (
									<Icon name="check" className="ml-auto size-4 shrink-0 text-primary" />
								) : (
									<Icon
										name="chevron-right"
										className="ml-auto size-4 shrink-0 text-tertiary opacity-0 transition-opacity group-hover:opacity-100 group-data-active-item:opacity-100"
									/>
								)}
							</Ariakit.MenuItem>
						)
					})}
				</div>
			</MenuSurface>
		</Ariakit.MenuProvider>
	)
}
