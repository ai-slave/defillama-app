import { describe, expect, test } from 'vitest'
import type { AuthModel } from '~/utils/pocketbase'
import {
	canEditResearchArticle,
	canManageResearchArticle,
	isResearcher,
	resolveArticlesGateState
} from '../ArticlesAccessGate'
import type { ArticleDocument } from '../types'

const user = (flags: AuthModel['flags'] = {}, id = 'viewer-id') =>
	({
		id,
		flags
	}) as AuthModel

const article = (overrides: Partial<ArticleDocument> = {}) =>
	({
		id: 'article-id',
		viewerRole: undefined,
		authorProfile: {
			pbUserId: 'owner-id'
		},
		...overrides
	}) as ArticleDocument

describe('research access helpers', () => {
	test('allows only is_researcher users into research tools', () => {
		expect(isResearcher(user({ is_researcher: true }))).toBe(true)
		expect(isResearcher(user({ articleAdmin: true }))).toBe(false)
		expect(isResearcher(user({ is_llama: true }))).toBe(false)
		expect(isResearcher(user({}))).toBe(false)
	})

	test('lets researchers edit any public article chip target', () => {
		expect(
			canEditResearchArticle({
				article: article(),
				isAuthenticated: true,
				user: user({ is_researcher: true }, 'researcher-id')
			})
		).toBe(true)
	})

	test('does not show edit access for unrelated llama users without a role', () => {
		expect(
			canEditResearchArticle({
				article: article(),
				isAuthenticated: true,
				user: user({ is_llama: true }, 'other-id')
			})
		).toBe(false)
	})

	test('does not show edit access for owners without researcher access', () => {
		expect(
			canEditResearchArticle({
				article: article({ viewerRole: 'owner' }),
				isAuthenticated: true,
				user: user({}, 'owner-id')
			})
		).toBe(false)
	})

	test('treats researcher viewer role as full editor management capability', () => {
		expect(canManageResearchArticle(article({ viewerRole: 'researcher' }))).toBe(true)
		expect(canManageResearchArticle(article({ viewerRole: 'owner' }))).toBe(true)
		expect(canManageResearchArticle(article({ viewerRole: 'collaborator' }))).toBe(false)
	})
})

describe('resolveArticlesGateState', () => {
	test('waits during the client hydration gap instead of redirecting', () => {
		expect(resolveArticlesGateState({ isClient: false, isLoading: false, hasAccess: false })).toBe('loading')
	})

	test('waits while auth is still loading', () => {
		expect(resolveArticlesGateState({ isClient: true, isLoading: true, hasAccess: false })).toBe('loading')
	})

	test('redirects only once hydrated and resolved without access', () => {
		expect(resolveArticlesGateState({ isClient: true, isLoading: false, hasAccess: false })).toBe('redirect')
	})

	test('authorizes a resolved researcher', () => {
		expect(resolveArticlesGateState({ isClient: true, isLoading: false, hasAccess: true })).toBe('authorized')
	})
})
