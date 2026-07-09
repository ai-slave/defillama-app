import { TokenLogo } from '~/components/TokenLogo'
import { Hovercard } from '~/ui/Hovercard'

/** "N chains" label that reveals the full chain list (logo + name per row)
    in a hovercard. Replaces the per-file ProtocolChainsComponent copies. */
export function ProtocolChainsHovercard({ chains, className }: { chains: string[]; className?: string }) {
	if (chains.length === 0) return null

	return (
		<Hovercard
			className={className ?? 'text-[0.7rem] text-secondary'}
			content={
				<span className="flex flex-col gap-1">
					{chains.map((chain) => (
						<span key={`chain${chain}-of-protocol`} className="flex items-center gap-1">
							<TokenLogo name={chain} kind="chain" size={14} alt={`Logo of ${chain}`} />
							<span>{chain}</span>
						</span>
					))}
				</span>
			}
		>
			{`${chains.length} chain${chains.length > 1 ? 's' : ''}`}
		</Hovercard>
	)
}
