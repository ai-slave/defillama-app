import type { QueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import type { ArticleDocument } from '../types'

const SAFE_LINK_SCHEMES = new Set(['http:', 'https:', 'mailto:', 'tel:'])

export function sanitizeLinkHref(raw: string): string | null {
	const value = raw.trim()
	if (!value) return null
	if (value.startsWith('#') || value.startsWith('/') || value.startsWith('?')) return value
	const schemeMatch = value.match(/^([a-z][a-z0-9+.-]*):/i)
	if (schemeMatch) {
		const scheme = `${schemeMatch[1]}:`.toLowerCase()
		return SAFE_LINK_SCHEMES.has(scheme) ? value : null
	}
	return `https://${value}`
}

export function slugFromTitle(title: string) {
	return (
		title
			.trim()
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, 120) || 'untitled'
	)
}

const pad = (n: number) => n.toString().padStart(2, '0')

export function toDateTimeLocal(iso: string | null | undefined): string {
	if (!iso) return ''
	const date = new Date(iso)
	if (Number.isNaN(date.getTime())) return ''
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function fromDateTimeLocal(value: string): string | null {
	if (!value) return null
	const date = new Date(value)
	return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export function formatArticleDate(iso: string | null | undefined): string {
	if (!iso) return ''
	const date = new Date(iso)
	if (Number.isNaN(date.getTime())) return ''
	return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export function useTicker(intervalMs = 30_000) {
	const [, set] = useState(0)
	useEffect(() => {
		const id = setInterval(() => set((c) => c + 1), intervalMs)
		return () => clearInterval(id)
	}, [intervalMs])
}

export function articleQueryKey(articleId: string | undefined) {
	return ['research', 'owned-article', articleId] as const
}

/** Every write that answers with the article carries this key, so an editor opening the article can wait for it. */
export function articleWriteKey(articleId: string | undefined) {
	return ['research', 'article-write', articleId] as const
}

/**
 * Stores a write's answer as the article, from the mutation's own onSuccess so it lands even after the reader
 * leaves and before the write stops counting as running. A read that started before the write finished is
 * cancelled first, or its older answer would replace this one.
 */
export async function cacheWrittenArticle(queryClient: QueryClient, saved: ArticleDocument) {
	await queryClient.cancelQueries({ queryKey: articleQueryKey(saved.id) })
	queryClient.setQueryData(articleQueryKey(saved.id), saved)
}
