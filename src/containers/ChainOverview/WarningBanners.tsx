import type { IChainOverviewData } from './types'

export function ChainWarningBanners({
	warningBanners,
	chainName
}: {
	warningBanners: IChainOverviewData['warningBanners']
	chainName: string
}) {
	return (
		<>
			{warningBanners?.map((banner) => (
				<p
					className={`relative rounded-md border p-2 text-center body-sm text-primary ${
						banner.level === 'rug'
							? 'border-error bg-error-tint-strong'
							: banner.level === 'alert'
								? 'border-warning bg-warning-tint-strong'
								: 'border-(--bg-color) bg-surface-elevated-1'
					}`}
					key={`${banner.message}-${banner.level}-${chainName}`}
				>
					{banner.message}
				</p>
			))}
		</>
	)
}
