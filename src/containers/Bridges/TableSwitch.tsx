import { BRIDGES_SHOWING_ADDRESSES, useLocalStorageSettingsManager } from '~/contexts/LocalStorage'
import { Icon } from '~/ui/Icon'
import { TAG_GROUP_SIZES, TAG_GROUP_VARIANTS } from '~/ui/SegmentedControl'

export function AddressesTableSwitch() {
	const [bridgesSettings, toggleBridgesSettings] = useLocalStorageSettingsManager('bridges')
	const isBridgesShowingAddresses = bridgesSettings[BRIDGES_SHOWING_ADDRESSES]

	return (
		<div className={`${TAG_GROUP_VARIANTS.default.container} ${TAG_GROUP_SIZES.md}`}>
			<button
				type="button"
				data-active={!isBridgesShowingAddresses}
				onClick={() => toggleBridgesSettings(BRIDGES_SHOWING_ADDRESSES)}
				className={`${TAG_GROUP_VARIANTS.default.button} flex items-center gap-1`}
			>
				<Icon name="trending-up" height={14} width={14} />
				<span>Tokens</span>
			</button>
			<button
				type="button"
				data-active={isBridgesShowingAddresses}
				onClick={() => toggleBridgesSettings(BRIDGES_SHOWING_ADDRESSES)}
				className={`${TAG_GROUP_VARIANTS.default.button} flex items-center gap-1`}
			>
				<Icon name="users" height={14} width={14} />
				<span>Addresses</span>
			</button>
		</div>
	)
}
