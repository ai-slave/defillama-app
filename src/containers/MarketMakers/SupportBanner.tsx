export function SupportBanner() {
	return (
		<div className="flex flex-col gap-6 border-t border-(--divider) pt-6 min-[713px]:flex-row min-[713px]:items-center min-[713px]:justify-between min-[713px]:gap-8">
			<div className="flex flex-col gap-4">
				<span className="text-sm font-semibold text-[#1A54C4]">Need support?</span>
				<h2 className="max-w-[620px] text-2xl font-semibold text-(--text-primary) min-[713px]:text-3xl">
					Contact us for a 1:1 consultation regarding all things related to tokenomics and launch strategy.
				</h2>
				<a
					href="https://www.forgd.com/schedule-a-consultation"
					target="_blank"
					rel="noreferrer noopener"
					className="inline-flex w-fit items-center rounded-lg bg-[#030021] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
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
