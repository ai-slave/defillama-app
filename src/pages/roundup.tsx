import { Announcement } from '~/components/Announcement'
import { fetchRoundup, type RoundupProps } from '~/containers/Roundup/api'
import Layout from '~/layout'
import { Card } from '~/ui/Card'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'

export default function Roundup({ messages, date }: RoundupProps) {
	return (
		<Layout
			title="Llama News Round-Up - DefiLlama"
			description="Daily DeFi news roundup curated by the DefiLlama team. Stay updated on protocol launches, governance changes, and market developments."
			canonicalUrl="/roundup"
		>
			<Announcement notCancellable>
				Get the roundup delivered for free by subscribing on{' '}
				<a href="https://t.me/defillama_tg" target="_blank" rel="noopener noreferrer" className="text-link underline">
					Telegram
				</a>
			</Announcement>

			<Card padding="sm" className="flex flex-col gap-3">
				<h1 className="text-center heading-sm">{`🦙 Llama News Round-Up ${date ?? ''}`}</h1>

				<div className="mx-auto flex max-w-lg flex-col gap-2 body-lg">
					{messages.map((x) => {
						if (typeof x === 'string') {
							return (
								<h2 className="my-2 font-semibold" key={x}>
									{x}
								</h2>
							)
						}

						return (
							<a href={x[1]} target="_blank" rel="noreferrer noopener" key={x[1]}>
								<span>&gt; </span>
								<span className="text-link underline">{x[0]}</span>
							</a>
						)
					})}
				</div>
			</Card>
		</Layout>
	)
}

export const getStaticProps = withPerformanceLogging('roundup', async () => {
	const roundup = await fetchRoundup(process.env.ROUND_UP_BOT_TOKEN)
	if (!roundup) return { notFound: true, revalidate: maxAgeForNext([22]) }
	return { props: roundup, revalidate: maxAgeForNext([22]) }
})
