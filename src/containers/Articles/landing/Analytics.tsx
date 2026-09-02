import { useRouter } from 'next/router'
import React, { useEffect, useRef } from 'react'
import { useIntersectionObserver } from '~/containers/Articles/landing/useIntersectionObserver'
import type { ArticleDocument, ArticleSection } from '~/containers/Articles/types'
import { trackUmamiEvent } from '~/utils/analytics/umami'

export type ResearchAnalyticsEventParams = [
	article: ArticleDocument | null,
	eventName: string,
	widgetLabel: string,
	triggeredOn?: string
]

function umamiPayloadFromArticle(article: ArticleDocument | null) {
	if (!article) {
		return {
			article_id: '',
			article_title: '',
			author: '',
			publish_date: '',
			topics: ''
		}
	}
	return {
		article_id: article.id,
		article_title: article.title,
		author: article.brandByline ? 'DefiLlama Research' : (article.authorProfile?.displayName ?? ''),
		publish_date: article.publishedAt ?? '',
		topics: (article.tags ?? []).join(',')
	}
}

export function pushResearchAnalyticsEvent(...args: ResearchAnalyticsEventParams) {
	const [article, eventName, widgetLabel, triggeredOn] = args
	trackUmamiEvent(eventName, {
		page_type: 'research',
		page_widget: widgetLabel,
		triggered_on: triggeredOn,
		...umamiPayloadFromArticle(article)
	})
}

export function useResearchSectionEngagement(section: ArticleSection) {
	const router = useRouter()

	useEffect(() => {
		// Product decision: only the report and spotlight landing pages are measured.
		// The other sections were not requested, so the hook is a no-op for them.
		if (section !== 'report' && section !== 'spotlight') return

		let activeMs = 0
		let activeSince = document.visibilityState === 'visible' ? performance.now() : null
		let maxScrollPercent = 0
		let sent = false

		const updateScrollDepth = () => {
			const scrollableHeight = Math.max(document.documentElement.scrollHeight - window.innerHeight, 0)
			const scrollPercent = scrollableHeight === 0 ? 100 : (window.scrollY / scrollableHeight) * 100
			maxScrollPercent = Math.max(maxScrollPercent, Math.min(100, Math.round(scrollPercent)))
		}

		const stopActiveTimer = () => {
			if (activeSince === null) return
			activeMs += performance.now() - activeSince
			activeSince = null
		}

		const sendEngagement = () => {
			if (sent) return
			sent = true
			stopActiveTimer()
			updateScrollDepth()
			trackUmamiEvent('research-section-engagement', {
				page_type: 'research',
				section,
				max_scroll_percent: maxScrollPercent,
				active_seconds: Math.round(activeMs / 1000)
			})
		}

		const handleVisibilityChange = () => {
			if (document.visibilityState === 'hidden') {
				stopActiveTimer()
			} else if (activeSince === null) {
				activeSince = performance.now()
			}
		}
		const handlePageHide = (event: PageTransitionEvent) => {
			if (event.persisted) {
				stopActiveTimer()
				return
			}
			sendEngagement()
		}
		const handlePageShow = (event: PageTransitionEvent) => {
			if (!event.persisted || sent || document.visibilityState !== 'visible' || activeSince !== null) return
			activeSince = performance.now()
			updateScrollDepth()
		}

		updateScrollDepth()
		window.addEventListener('scroll', updateScrollDepth, { passive: true })
		window.addEventListener('resize', updateScrollDepth)
		window.addEventListener('pagehide', handlePageHide)
		window.addEventListener('pageshow', handlePageShow)
		document.addEventListener('visibilitychange', handleVisibilityChange)
		router.events.on('beforeHistoryChange', sendEngagement)

		return () => {
			window.removeEventListener('scroll', updateScrollDepth)
			window.removeEventListener('resize', updateScrollDepth)
			window.removeEventListener('pagehide', handlePageHide)
			window.removeEventListener('pageshow', handlePageShow)
			document.removeEventListener('visibilitychange', handleVisibilityChange)
			router.events.off('beforeHistoryChange', sendEngagement)
		}
	}, [router.events, section])
}

interface InViewAnalyticsProps {
	eventParams: ResearchAnalyticsEventParams
	intersectionOptions?: IntersectionObserverInit & { freezeOnceVisible?: boolean }
}

export const InViewAnalytics: React.FC<InViewAnalyticsProps> = (props) => {
	const {
		eventParams,
		intersectionOptions = {
			freezeOnceVisible: true
		}
	} = props

	const { ref, isIntersecting } = useIntersectionObserver(intersectionOptions)
	const paramsRef = useRef(eventParams)
	paramsRef.current = eventParams

	useEffect(() => {
		if (isIntersecting) {
			pushResearchAnalyticsEvent(...paramsRef.current)
		}
	}, [isIntersecting])

	return <div ref={ref} className="invisible" />
}
