import * as Ariakit from '@ariakit/react'
import { useState } from 'react'
import { BasicLink } from '~/components/Link'
import { Icon } from '~/ui/Icon'

export function OAuthWelcomeDialog({
	isOpen,
	onContinue
}: {
	isOpen: boolean
	onContinue: (promotionalEmails: 'on' | 'off') => void
}) {
	const [acceptedTerms, setAcceptedTerms] = useState(false)
	const [promotionalEmails, setPromotionalEmails] = useState(true)

	return (
		<Ariakit.DialogProvider open={isOpen}>
			<Ariakit.Dialog
				backdrop={<div className="bg-black/60" />}
				className="dialog top-1/2 right-auto bottom-auto left-1/2 m-0 max-h-[90dvh] min-h-0 w-[calc(100vw-32px)] max-w-[360px] -translate-x-1/2 -translate-y-1/2 gap-0 overflow-y-auto rounded-2xl bg-signin-bg px-5 pt-6 pb-5 shadow-2xl"
				portal
				unmountOnHide
				hideOnEscape={false}
				hideOnInteractOutside={false}
			>
				<div className="mb-6 flex flex-col items-center gap-3 text-center">
					<div className="flex size-12 items-center justify-center rounded-full bg-brand/10">
						<Icon name="check" height={24} width={24} className="text-brand" />
					</div>
					<h2 className="text-xl font-semibold text-primary">Thanks for signing up!</h2>
					<p className="text-sm text-tertiary">Your account has been created.</p>
				</div>

				<div className="flex flex-col gap-4">
					<label className="flex items-start gap-2">
						<input
							type="checkbox"
							className="mt-0.5 size-4 shrink-0 rounded-sm accent-brand"
							checked={acceptedTerms}
							onChange={(e) => setAcceptedTerms(e.target.checked)}
						/>
						<span className="text-xs leading-4 text-tertiary">
							I agree to the{' '}
							<BasicLink href="/terms" target="_blank" className="text-link underline">
								Terms of Service
							</BasicLink>{' '}
							and{' '}
							<BasicLink href="/privacy-policy" target="_blank" className="text-link underline">
								Privacy Policy
							</BasicLink>
						</span>
					</label>

					<label className="flex items-start gap-2">
						<input
							type="checkbox"
							className="mt-0.5 size-4 shrink-0 rounded-sm accent-brand"
							checked={promotionalEmails}
							onChange={(e) => setPromotionalEmails(e.target.checked)}
						/>
						<span className="text-xs leading-4 text-tertiary">
							Receive emails about upcoming DefiLlama products and new releases
						</span>
					</label>

					<button
						type="button"
						disabled={!acceptedTerms}
						className="h-10 w-full rounded-lg bg-brand text-sm font-medium text-on-brand disabled:bg-signin-btn-disabled-bg disabled:text-signin-btn-disabled-text"
						onClick={() => onContinue(promotionalEmails ? 'on' : 'off')}
					>
						Continue
					</button>
				</div>
			</Ariakit.Dialog>
		</Ariakit.DialogProvider>
	)
}
