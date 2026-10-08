import { useAuthContext } from '~/auth'
import { PROMO_EMAILS_TEXT } from '~/containers/Subscription/constants'
import { Icon } from '~/ui/Icon'
import { ToggleSwitch } from './ToggleSwitch'

export function SettingsCard() {
	const { user, setPromotionalEmails, loaders } = useAuthContext()

	const promoEmailsOn = user?.promotionalEmails === 'on' || user?.promotionalEmails === 'initial'

	const handleTogglePromoEmails = () => {
		if (loaders.setPromotionalEmails) return
		setPromotionalEmails(promoEmailsOn ? 'off' : 'on')
	}

	return (
		<div className="flex flex-col gap-4 rounded-2xl border border-subtle bg-surface p-4">
			<div className="flex items-center gap-2">
				<Icon name="gear-settings" height={28} width={28} className="text-primary" />
				<span className="label-lg text-primary">Settings</span>
			</div>

			<div className="flex flex-col gap-4">
				<div className="flex flex-col gap-1">
					<div className="flex items-center justify-between">
						<span className="body-md text-primary">Receive promotional emails</span>
						<ToggleSwitch
							checked={promoEmailsOn}
							onClick={handleTogglePromoEmails}
							disabled={loaders.setPromotionalEmails}
							aria-label="Receive promotional emails"
						/>
					</div>
					<p className="max-w-[400px] body-sm text-tertiary">{PROMO_EMAILS_TEXT}</p>
				</div>
			</div>
		</div>
	)
}
