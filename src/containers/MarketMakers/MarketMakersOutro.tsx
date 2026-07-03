import { MarketMakersFooter } from './Footer'
import { ReadyToStart } from './ReadyToStart'
import { SupportBanner } from './SupportBanner'

export function MarketMakersOutro() {
	return (
		<div className="flex flex-col gap-6">
			<ReadyToStart />
			<SupportBanner />
			<MarketMakersFooter />
		</div>
	)
}
