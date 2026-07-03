export function MarketMakersFooter() {
	return (
		<div className="flex flex-col gap-2 border-t border-(--divider) pt-4 text-sm min-[713px]:flex-row min-[713px]:items-start min-[713px]:justify-between min-[713px]:gap-6">
			<p className="text-(--text-secondary)">
				© 2026 Forgd. All rights reserved.{' '}
				<a
					href="https://www.forgd.com/terms-conditions"
					target="_blank"
					rel="noreferrer noopener"
					className="font-medium text-(--link-text) hover:underline"
				>
					Terms & Conditions
				</a>
			</p>
			<p className="text-(--text-tertiary) min-[713px]:max-w-[560px] min-[713px]:text-right">
				The content on this site is for informational purposes only and should not be construed as financial or legal
				advice.
			</p>
		</div>
	)
}
