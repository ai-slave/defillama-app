import type { GetServerSideProps, GetServerSidePropsContext } from 'next'

// Reject extra URL segments without generating an empty static page for every session.
export const getServerSideProps = (async ({
	params
}: Pick<GetServerSidePropsContext<{ sessionId?: Array<string> }>, 'params'>) => {
	if ((params?.sessionId?.length ?? 0) > 1) return { notFound: true }
	return { props: {} }
}) satisfies GetServerSideProps<Record<string, never>, { sessionId?: Array<string> }>
