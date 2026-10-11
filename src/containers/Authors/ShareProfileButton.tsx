import * as Ariakit from '@ariakit/react'
import { ExternalLinkButton } from '~/components/ExternalLinkButton'
import { Button } from '~/ui/Button'
import { CopyHelper } from '~/ui/Copy'
import { Field } from '~/ui/Field'
import { Icon } from '~/ui/Icon'
import { Input } from '~/ui/Input'
import { PopoverSurface } from '~/ui/PopoverSurface'

export function ShareProfileButton({ slug, displayName }: { slug: string; displayName: string }) {
	const popover = Ariakit.usePopoverStore({ placement: 'bottom-start' })

	const shareUrl = `${typeof window !== 'undefined' ? window.location.origin : 'https://defillama.com'}/authors/${slug}`

	const text = encodeURIComponent(`Check out ${displayName}'s dashboards on DefiLlama`)
	const url = encodeURIComponent(shareUrl)

	return (
		<Ariakit.PopoverProvider store={popover}>
			<Ariakit.PopoverDisclosure render={<Button variant="secondary" size="md" />}>
				<Icon name="share" className="size-3.5" />
				Share
			</Ariakit.PopoverDisclosure>

			<PopoverSurface variant="panel" heading="Share profile" gutter={8} width="md">
				<div className="flex flex-col gap-3 p-3">
					<Field label="Profile link">
						{(control) => (
							<div className="flex items-center gap-2">
								<Input {...control} type="text" value={shareUrl} readOnly className="min-w-0 flex-1" />
								<CopyHelper toCopy={shareUrl} aria-label="Copy profile link" />
							</div>
						)}
					</Field>

					<div className="flex flex-col gap-1.5">
						<p className="label-sm text-secondary">Share on</p>
						<div className="flex gap-2">
							<ExternalLinkButton
								href={`https://x.com/intent/tweet?text=${text}&url=${url}`}
								icon="twitter"
								className="flex-1"
							>
								X/Twitter
							</ExternalLinkButton>
							<ExternalLinkButton
								href={`https://t.me/share/url?text=${text}&url=${url}`}
								icon="telegram"
								className="flex-1"
							>
								Telegram
							</ExternalLinkButton>
						</div>
					</div>
				</div>
			</PopoverSurface>
		</Ariakit.PopoverProvider>
	)
}
