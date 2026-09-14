import * as Ariakit from '@ariakit/react'
import { Icon } from '~/ui/Icon'
import type { DashboardItemConfig } from '../../dashboardItemConfig'
import { ProButton } from '../../ui'
import { getMainTabEditLabel } from './TabNavigation'
import type { MainTabType } from './types'

interface ModalHeaderProps {
	editItem?: DashboardItemConfig | null | undefined
	selectedMainTab: MainTabType
}

export function ModalHeader({ editItem, selectedMainTab }: ModalHeaderProps) {
	return (
		<div className="flex items-center justify-between">
			<Ariakit.DialogHeading
				className="text-xl font-semibold text-pro-text-primary"
				render={<h2>{editItem ? `Edit card · ${getMainTabEditLabel(selectedMainTab)}` : 'Add card'}</h2>}
			/>
			<Ariakit.DialogDismiss render={<ProButton size="md" square variant="ghost" />}>
				<Icon name="x" height={16} width={16} />
				<span className="sr-only">Close dialog</span>
			</Ariakit.DialogDismiss>
		</div>
	)
}
