import { useInvestorsSite } from './SiteContext'

export function Logo({ size = 'default', href }: { size?: 'default' | 'sm'; href?: string }) {
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
						? 'rounded-full border border-brand-muted px-2 py-0.5 label-sm tracking-[0.12em] text-link uppercase'
						: 'rounded-full border border-brand-muted px-3 py-1 label-sm tracking-[0.15em] text-link uppercase'
				}
			>
				{sm ? smallSubtitle : subtitle}
			</span>
		</>
	)

	const cls = `flex select-none ${sm ? 'items-center gap-2' : 'flex-col items-center gap-2.5'}`

	if (href) {
		return (
			<a href={href} className={cls}>
				{content}
			</a>
		)
	}

	return <div className={cls}>{content}</div>
}
