import { afterEach, describe, expect, test, vi } from 'vitest'
import { withPageClockServerSideProps, withPageClockStaticProps } from '../pageClock'

describe('page clock', () => {
	afterEach(() => vi.useRealTimers())

	test('stamps the render second into props and leaves the other results alone', () => {
		vi.useFakeTimers({ now: 1_700_000_000_500 })
		expect(withPageClockStaticProps({ props: { ok: true }, revalidate: 60 })).toEqual({
			props: { ok: true, pageClockSec: 1_700_000_000 },
			revalidate: 60
		})
		expect(withPageClockStaticProps({ notFound: true })).toEqual({ notFound: true })
		expect(withPageClockStaticProps({ redirect: { destination: '/x', permanent: false } })).toEqual({
			redirect: { destination: '/x', permanent: false }
		})
	})

	test('keeps a clock the page computed with its data', () => {
		vi.useFakeTimers({ now: 1_700_000_000_000 })
		expect(withPageClockStaticProps({ props: { pageClockSec: 1_690_000_000 } })).toEqual({
			props: { pageClockSec: 1_690_000_000 }
		})
	})

	test('stamps lazily resolved server-side props when they arrive', async () => {
		vi.useFakeTimers({ now: 1_700_000_000_000 })
		const result = withPageClockServerSideProps({ props: Promise.resolve({ id: 'abc' }) })
		expect('props' in result && (await result.props)).toEqual({ id: 'abc', pageClockSec: 1_700_000_000 })
		expect(withPageClockServerSideProps({ props: { id: 'abc' } })).toEqual({
			props: { id: 'abc', pageClockSec: 1_700_000_000 }
		})
	})
})
