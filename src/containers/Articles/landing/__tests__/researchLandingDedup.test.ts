import { describe, expect, test } from 'vitest'
import { takeUniqueArticles } from '~/containers/Articles/landing/utils'

type ArticleStub = { id: string; title: string }

const article = (id: string): ArticleStub => ({ id, title: `Article ${id}` })

describe('researchLandingDedup', () => {
	describe('takeUniqueArticles', () => {
		test('preserves order, excludes used ids, and stops at limit or when candidates run out', () => {
			const candidates = [article('1'), article('2'), article('3'), article('4'), article('5')]
			const excluded = new Set(['2', '4'])

			expect(takeUniqueArticles(candidates, excluded, 2)).toEqual([article('1'), article('3')])
			expect(takeUniqueArticles(candidates, excluded, 15)).toEqual([article('1'), article('3'), article('5')])
		})
	})
})
