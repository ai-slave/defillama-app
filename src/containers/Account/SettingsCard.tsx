import { useAuthContext } from '~/auth'
import { PROMO_EMAILS_TEXT } from '~/containers/Subscription/constants'
import { Card } from '~/ui/Card'
import { Icon } from '~/ui/Icon'
import { Switch } from '~/ui/Switch'

export function SettingsCard() {
	const { user, setPromotionalEmails, loaders } = useAuthContext()

	const promoEmailsOn = user?.promotionalEmails === 'on' || user?.promotionalEmails === 'initial'

	const handleTogglePromoEmails = () => {
		if (loaders.setPromotionalEmails) return
		setPromotionalEmails(promoEmailsOn ? 'off' : 'on')
	}

	return (
		<Card padding="md" className="flex flex-col gap-4">
			<div className="flex items-center gap-2">
				<Icon name="settings" className="size-7 text-primary" />
				<span className="label-lg text-primary">Settings</span>
			</div>

			<div className="flex flex-col gap-4">
				<div className="flex flex-col gap-1">
					<div className="flex items-center justify-between">
						<span className="body-md text-primary">Receive promotional emails</span>
						<Switch
							label="Receive promotional emails"
							hideLabel
							value="promo-emails"
							checked={promoEmailsOn}
							onChange={handleTogglePromoEmails}
							isLoading={loaders.setPromotionalEmails}
						/>
					</div>
					<p className="max-w-[400px] body-sm text-tertiary">{PROMO_EMAILS_TEXT}</p>
				</div>
			</div>
		</Card>
	)
}
