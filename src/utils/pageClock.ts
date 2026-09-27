import type { GetServerSidePropsResult, GetStaticPropsResult } from 'next'

/**
 * The page clock: the unix second a page's props were built. It travels in the props, so the hydrating client renders
 * the same "now" as the server did, and only then moves to the browser clock. Every data function that goes through
 * `withPerformanceLogging` or `withServerSidePropsTelemetry` carries it; `useNowSeconds` reads it from `_app`.
 */
export const PAGE_CLOCK_PROP = 'pageClockSec'

export type PageClockProps = { [PAGE_CLOCK_PROP]?: number }

function stamp<T extends { [key: string]: unknown }>(props: T): T & PageClockProps {
	// A page that already computed its clock alongside its data keeps that one, so its labels stay data-consistent.
	if (typeof props[PAGE_CLOCK_PROP] === 'number') return props
	return { ...props, [PAGE_CLOCK_PROP]: Math.floor(Date.now() / 1000) }
}

export function withPageClockStaticProps<T extends { [key: string]: unknown }>(
	result: GetStaticPropsResult<T>
): GetStaticPropsResult<T & PageClockProps> {
	if (!('props' in result)) return result
	return { ...result, props: stamp(result.props) }
}

export function withPageClockServerSideProps<T extends { [key: string]: unknown }>(
	result: GetServerSidePropsResult<T>
): GetServerSidePropsResult<T & PageClockProps> {
	if (!('props' in result)) return result
	const props = result.props
	// getServerSideProps may resolve its props lazily; stamp when they arrive.
	if (props instanceof Promise) return { ...result, props: props.then(stamp) }
	return { ...result, props: stamp(props) }
}
