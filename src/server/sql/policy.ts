import type { SqlQueryRecipe } from '~/containers/ProDashboard/types'

// Intentionally inspect the entire input, including comments and string literals.
// False positives are preferable to allowing administrative SQL on this endpoint.
const BLOCKED_WORDS = new Set(
	[
		'alter',
		'analyze',
		'attach',
		'begin',
		'call',
		'checkpoint',
		'comment',
		'commit',
		'copy',
		'create',
		'deallocate',
		'delete',
		'describe',
		'detach',
		'drop',
		'execute',
		'explain',
		'export',
		'force',
		'grant',
		'import',
		'insert',
		'install',
		'load',
		'merge',
		'pragma',
		'prepare',
		'reindex',
		'release',
		'reset',
		'revoke',
		'rollback',
		'savepoint',
		'secret',
		'secrets',
		'set',
		'show',
		'summarize',
		'transaction',
		'truncate',
		'uninstall',
		'update',
		'use',
		'vacuum',
		'current_database',
		'current_catalog',
		'current_role',
		'current_connection_id',
		'current_query_id',
		'current_transaction_id',
		'current_query',
		'current_schema',
		'current_schemas',
		'current_setting',
		'current_user',
		'database',
		'database_list',
		'database_size',
		'extension_versions',
		'functions',
		'metadata_info',
		'platform',
		'storage_info',
		'table_info',
		'user_agent',
		'add_parquet_key',
		'copy_database',
		'getenv',
		'getvariable',
		'setvariable',
		'session_user',
		'version',
		'information_schema',
		'pg_catalog',
		'sqlite_master',
		'sqlite_schema',
		'system',
		'query',
		'query_table',
		'query_table_columns',
		// These built-in table macros expand to query_table with a dynamic source.
		'histogram',
		'histogram_values',
		'truncate_duckdb_logs',
		'import_database',
		'nextval',
		'currval',
		'txid_current',
		'which_secret',
		'sniff_csv',
		'glob',
		'httpfs',
		'http',
		'https',
		'readfile',
		'writefile',
		'file',
		'url',
		'remote',
		'remoteSecure',
		's3',
		's3cluster',
		'azure',
		'mysql',
		'postgres',
		'sqlite',
		'odbc',
		'jdbc',
		'shell'
	].map((word) => word.toLowerCase())
)

export class SqlPolicyError extends Error {}

export function validateSql(sql: string): void {
	if (typeof sql !== 'string' || !sql.trim()) throw new SqlPolicyError('Empty query.')

	for (const match of sql.matchAll(/[a-z_][a-z0-9_]*/gi)) {
		const word = match[0].toLowerCase()
		if (
			BLOCKED_WORDS.has(word) ||
			/^(?:read_|write_|duckdb_|pragma_|sqlite_|pg_|postgres_|mysql_|http_|s3_|parquet_|iceberg_|delta_|st_read|enable_|disable_|verify_|force_|show_|sql_|json_(?:execute|serialize|deserialize)_)/.test(
				word
			) ||
			word.endsWith('_scan')
		) {
			throw new SqlPolicyError('Something went wrong')
		}
	}

	// The worker uses DuckDB's parser to enforce a single SELECT statement.
	// In particular, a semicolon inside an analytical string is not a statement boundary.
	if (!/^(?:select|with)\b/i.test(sql.trim())) {
		throw new SqlPolicyError('Only a SELECT or WITH query is allowed.')
	}
}

export function validateSqlRecipe(recipe: SqlQueryRecipe): void {
	if (!recipe || typeof recipe.sql !== 'string' || !Array.isArray(recipe.tableSources)) {
		throw new SqlPolicyError('Invalid SQL recipe: sql and tableSources are required.')
	}
	validateSql(recipe.sql)
	for (const source of recipe.tableSources) {
		if (
			!source ||
			typeof source.slug !== 'string' ||
			!source.slug ||
			(source.kind !== 'dataset' && source.kind !== 'chart') ||
			(source.kind === 'chart' && (typeof source.param !== 'string' || !source.param.trim()))
		) {
			throw new SqlPolicyError('Invalid SQL table source.')
		}
	}
}
