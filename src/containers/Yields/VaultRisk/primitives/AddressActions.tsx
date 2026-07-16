import { CopyHelper } from '~/components/Copy'
import { Icon } from '~/components/Icon'

// The section's one address grammar: mono address, then copy + explorer-link icons.
export function AddressActions({
	address,
	url,
	label = 'address'
}: {
	address: string
	url?: string | null
	label?: string
}) {
	const short = address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address
	return (
		<span className="inline-flex items-center gap-0.5">
			<span className="mono-sm text-secondary">{short}</span>
			<CopyHelper
				toCopy={address}
				size={12}
				aria-label={`Copy ${label}`}
				className="flex shrink-0 items-center p-0.5 text-secondary hover:text-primary"
			/>
			{url ? (
				<a
					href={url}
					target="_blank"
					rel="noreferrer"
					aria-label={`Open ${label} in block explorer`}
					className="flex shrink-0 items-center p-0.5 text-secondary hover:text-primary"
				>
					<Icon name="arrow-up-right" className="size-3" />
				</a>
			) : null}
		</span>
	)
}
