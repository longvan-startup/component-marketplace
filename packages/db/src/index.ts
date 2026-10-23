/**
 * @marketplace/db — Drizzle client factory (PostgreSQL qua postgres.js).
 * Dùng chung cho api (và web server-side sau này).
 */

import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import * as schema from './schema'

export type { Component, NewComponent, NewUser, User } from './schema'
export { schema }

export type Database = PostgresJsDatabase<typeof schema>

/** Tạo Drizzle DB instance từ connection string. */
export function createDb(url: string): Database {
  const client = postgres(url)
  return drizzle(client, { schema })
}
