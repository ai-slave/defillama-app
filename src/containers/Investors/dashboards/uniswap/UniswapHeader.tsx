import { useQuery } from '@tanstack/react-query'
import { Card } from '~/ui/Card'
import { readInvestorApiJson } from '../../api.types'
import { IrHeaderLinks } from '../../IrHeaderLinks'
import { UniswapLogo } from './UniswapLogo'

interface Metadata {
	projectName: string
	links: Partial<Record<'website' | 'app' | 'docs' | 'governance' | 'x' | 'github', string>>
}

export default function UniswapHeader() {
	const { data } = useQuery<Metadata>({
		queryKey: ['uniswap', 'metadata'],
		queryFn: async () => {
			const res = await fetch('/api/public/uniswap/metadata')
			if (!res.ok) throw new Error(`Uniswap metadata error: ${res.status}`)
			return readInvestorApiJson<Metadata>(res)
		},
		staleTime: 60 * 60 * 1000,
		refetchOnWindowFocus: false
	})

	const links = data?.links ?? {}

	return (
		<Card as="header" padding="strip" className="flex flex-wrap items-center gap-x-3 gap-y-2">
			<UniswapLogo />
			<div className="leading-tight">
				<span className="title-md text-primary">{data?.projectName ?? 'Uniswap'}</span>
			</div>
			<IrHeaderLinks
				links={[
					{ label: 'X', href: links.x, icon: 'twitter' },
					{ label: 'Docs', href: links.docs, icon: 'file-text' },
					{ label: 'Governance', href: links.governance, icon: 'landmark' }
				]}
				launch={
					links.app
						? { label: 'Launch App', href: links.app, background: 'linear-gradient(135deg, #FF007A, #FC72FF)' }
						: undefined
				}
			/>
		</Card>
	)
}
