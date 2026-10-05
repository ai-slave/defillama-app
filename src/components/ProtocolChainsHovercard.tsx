import { TokenLogo } from '~/components/TokenLogo'
import { Hovercard } from '~/ui/Hovercard'

/** "N chains" label that reveals the full chain list (logo + name per row)
    in a hovercard. Replaces the per-file ProtocolChainsComponent copies. */
export function ProtocolChainsHovercard({ chains, className }: { chains: Array<string>; className?: string }) {
	if (chains.length === 0) return null

	return (
		<Hovercard
			// self-start: the label sits under the name in a flex column, where a stretched anchor would span the
			// name's width and push the card away from the label.
			className={`self-start ${className ?? 'body-sm text-secondary'}`}
			placement="right-start"
			contentClassName="w-max max-w-[min(20rem,var(--popover-available-width))] p-3"
			content={
				<span className="flex flex-col gap-1">
					{chains.map((chain) => (
						<span key={`chain${chain}-of-protocol`} className="flex items-center gap-1">
							<TokenLogo name={chain} kind="chain" size={14} alt={`Logo of ${chain}`} />
							<span className="min-w-0 break-words">{chain}</span>
						</span>
					))}
				</span>
			}
		>
			{`${chains.length} chain${chains.length > 1 ? 's' : ''}`}
		</Hovercard>
	)
}
