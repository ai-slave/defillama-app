import { forgdPrimaryLinkStyles } from './styles'

export function SupportBanner() {
	return (
		<div className="flex flex-col gap-6 border-t border-subtle pt-6 min-[713px]:flex-row min-[713px]:items-center min-[713px]:justify-between min-[713px]:gap-8">
			<div className="flex flex-col gap-4">
				<span className="text-sm font-semibold text-[#1A54C4]">Need support?</span>
				<h2 className="heading-md max-w-[620px] text-primary">
					Contact us for a 1:1 consultation regarding all things related to tokenomics and launch strategy.
				</h2>
				<a
					href="https://www.forgd.com/schedule-a-consultation"
					target="_blank"
					rel="noreferrer noopener"
					className={`${forgdPrimaryLinkStyles} w-fit`}
				>
					Schedule a 1:1 Consultation
				</a>
			</div>
			<img
				src="/market-makers-docs/circle-portal.svg"
				alt=""
				aria-hidden
				width={220}
				height={220}
				className="order-first size-[180px] shrink-0 self-center min-[713px]:order-none min-[713px]:size-[220px]"
			/>
		</div>
	)
}
