import { useQuery } from '@tanstack/react-query'
import { Card } from '~/ui/Card'
import { readInvestorApiJson } from '../../api.types'
import { IrHeaderLinks } from '../../IrHeaderLinks'

interface Metadata {
	projectName: string
	token: { symbol: string }
	links: Partial<Record<'website' | 'docs' | 'x' | 'explorer' | 'data', string>>
	launchUrl?: string
}

export default function ThorchainHeader() {
	const { data } = useQuery<Metadata>({
		queryKey: ['thorchain-metadata'],
		queryFn: async () => {
			const res = await fetch('/api/public/thorchain/metadata')
			if (!res.ok) throw new Error(`THORChain metadata error: ${res.status}`)
			return readInvestorApiJson<Metadata>(res)
		},
		staleTime: 60 * 60 * 1000,
		refetchOnWindowFocus: false
	})

	const links = data?.links ?? {}

	return (
		<Card as="header" padding="strip" className="flex flex-wrap items-center gap-x-3 gap-y-2">
			{/* RUNE token mark, inlined so the dashboard owns it (no asset file dependency). */}
			<svg viewBox="0 0 300 300" role="img" aria-label="THORChain" className="size-8 shrink-0">
				<circle cx="150" cy="150" r="150" fill="url(#rune-logo)" />
				<path
					d="M54 265L207.721 197.386L159.058 145.843L54 265ZM110.471 94.3804L159.134 145.843L246 35L110.471 94.3804Z"
					fill="white"
				/>
				<defs>
					<linearGradient id="rune-logo" x1="300" y1="150.23" x2="0" y2="150.23" gradientUnits="userSpaceOnUse">
						<stop stopColor="#33FF99" />
						<stop offset="1" stopColor="#00CCFF" />
					</linearGradient>
				</defs>
			</svg>
			<div className="leading-tight">
				<span className="title-md text-primary">{data?.projectName ?? 'THORChain'}</span>
			</div>
			<IrHeaderLinks
				links={[
					{ label: 'X', href: links.x, icon: 'twitter' },
					{ label: 'Explorer', href: links.explorer, icon: 'search' }
				]}
				launch={
					data?.launchUrl
						? {
								label: 'Launch App',
								href: data.launchUrl,
								background: 'linear-gradient(135deg, #00CCFF, #31FD9D)',
								darkLabel: true
							}
						: undefined
				}
			/>
		</Card>
	)
}
