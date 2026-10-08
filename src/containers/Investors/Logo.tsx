import { useInvestorsSite } from './SiteContext'

export function Logo({
	animate = false,
	size = 'default',
	href
}: {
	animate?: boolean
	size?: 'default' | 'sm'
	href?: string
}) {
	const site = useInvestorsSite()
	const isEnterprise = site?.id === 'enterprise'
	const subtitle = isEnterprise ? 'Enterprise' : 'Investor Relations'
	const smallSubtitle = isEnterprise ? 'ENT' : 'IR'
	const sm = size === 'sm'
	const content = (
		<>
			<img
				src="/assets/defillama.webp"
				height={sm ? 24 : 36}
				width={sm ? 94 : 140}
				className="hidden object-contain dark:block"
				alt="DefiLlama"
			/>
			<img
				src="/assets/defillama-dark.webp"
				height={sm ? 24 : 36}
				width={sm ? 94 : 140}
				className="object-contain dark:hidden"
				alt="DefiLlama"
			/>
			<span
				className={
					sm
						? 'rounded-full border border-sl-accent/40 px-2 py-0.5 label-sm tracking-[0.12em] text-sl-accent/60 uppercase'
						: 'rounded-full border border-sl-accent/40 px-3 py-1 label-sm tracking-[0.15em] text-sl-accent/60 uppercase'
				}
			>
				{sm ? smallSubtitle : subtitle}
			</span>
		</>
	)

	const cls = `flex select-none ${sm ? 'items-center gap-2' : 'flex-col items-center gap-2.5'}${animate ? ' sl-loader' : ''}`

	if (href) {
		return (
			<a href={href} className={cls}>
				{content}
			</a>
		)
	}

	return <div className={cls}>{content}</div>
}

export function TextLoader() {
	const site = useInvestorsSite()
	if (site?.id === 'enterprise') {
		return (
			<div className="sl-loader text-center leading-none select-none">
				<span
					className="block heading-lg tracking-[0.08em] text-transparent"
					style={{ WebkitTextStroke: '1px var(--sl-stroke-brand)' }}
				>
					ENTERPRISE
				</span>
			</div>
		)
	}
	return (
		<div className="sl-loader text-center leading-none select-none">
			<span className="block label-md tracking-[0.4em] text-sl-text-brand">INVESTOR</span>
			<span
				className="block heading-lg tracking-[0.08em] text-transparent"
				style={{ WebkitTextStroke: '1px var(--sl-stroke-brand)' }}
			>
				RELATIONS
			</span>
		</div>
	)
}
