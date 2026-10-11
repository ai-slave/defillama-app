import { useNowSeconds } from '~/hooks/useNowSeconds'
import { PageClockProvider } from '~/hooks/usePageClock'
import { DataFreshness } from '~/ui/DataFreshness'
import { RelativeTime } from '~/ui/RelativeTime'
import { StaleText } from '~/ui/StaleText'
import { Example, type Family, Row } from '../shared'

// RelativeTime follows the visitor's clock after hydration, so a fixed timestamp would drift into a date within a
// week. Each demo is an offset from the clock the hook returns, with a fixed seed for the server render, so it reads
// the same on every load. 2025-07-24T16:30:00Z.
const SEED_SECONDS = 1_753_374_600
const FIXED_PAST_MS = Date.UTC(2025, 6, 24, 16, 30)

const WHEN_SECONDS_AGO = {
	'5 minutes ago': 5 * 60,
	'3 hours ago': 3 * 3600,
	'2 days ago': 2 * 86_400,
	'in 26 hours': -26 * 3600
}
const AGE_SECONDS = { '7 hours': 7 * 3600, '1 day': 86_400, '3 days': 3 * 86_400 }

function Ago({ seconds, children }: { seconds: number; children: (timestamp: number) => React.ReactNode }) {
	return <>{children(useNowSeconds(SEED_SECONDS) - seconds)}</>
}

export const time: Family = {
	id: 'time',
	title: 'Time',
	parts: [
		{
			name: 'DataFreshness',
			source: 'src/ui/DataFreshness.tsx',
			knobs: [{ name: 'age', values: Object.keys(AGE_SECONDS), default: '7 hours', prop: false }],
			render: (values) => (
				<PageClockProvider pageClockSec={SEED_SECONDS}>
					<Ago seconds={AGE_SECONDS[values.age as keyof typeof AGE_SECONDS]}>
						{(t) => <DataFreshness timestamp={t} label="Prices last updated" />}
					</Ago>
				</PageClockProvider>
			)
		},
		{
			name: 'RelativeTime',
			source: 'src/ui/RelativeTime.tsx',
			knobs: [
				{ name: 'when', values: Object.keys(WHEN_SECONDS_AGO), default: '5 minutes ago', prop: false },
				{ name: 'prefix', values: ['none', 'Updated'], default: 'none' }
			],
			note: 'Hover for the exact instant.',
			render: (values) => (
				<PageClockProvider pageClockSec={SEED_SECONDS}>
					<Ago seconds={WHEN_SECONDS_AGO[values.when as keyof typeof WHEN_SECONDS_AGO]}>
						{(t) => (
							<RelativeTime
								value={t}
								input="seconds"
								prefix={values.prefix === 'none' ? undefined : (values.prefix as string)}
							/>
						)}
					</Ago>
				</PageClockProvider>
			),
			states: () => (
				<PageClockProvider pageClockSec={SEED_SECONDS}>
					<Example name="Past label, milliseconds and fallback" prop="pastLabel / input / fallback">
						<Row>
							<Ago seconds={3600}>{(t) => <RelativeTime value={t} input="seconds" pastLabel="Unlocked" />}</Ago>
							<RelativeTime value={FIXED_PAST_MS} input="milliseconds" prefix="Updated" />
							<RelativeTime value={null} fallback="Never" />
						</Row>
					</Example>
				</PageClockProvider>
			)
		},
		{
			name: 'StaleText',
			source: 'src/ui/StaleText.tsx',
			knobs: [{ name: 'as', values: ['span', 'h4'], default: 'span' }],
			render: (values) =>
				values.as === 'h4' ? (
					<StaleText as="h4" className="label-md">
						2025
					</StaleText>
				) : (
					<StaleText className="mono-md">$61,204.18</StaleText>
				)
		}
	]
}
