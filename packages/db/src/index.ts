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

/** Handle đóng rõ nghĩa: API dùng trong graceful shutdown (#29). */
export interface DatabaseHandle {
  db: Database
  /** Kết thúc postgres.js client (pool) — chờ tối đa `timeout` giây. */
  close: (options?: { timeout?: number }) => Promise<void>
}

/**
 * Tạo db + client KÈOM handle đóng. API dùng variant này để shutdown có thể
 * `close()`: SIGTERM = ngừng nhận request mới, `server.close()` drain xong,
 * `pool.end()` sau cùng — không rớt request đang chạy.
 *
 * `connect_timeout` (s) giới hạn thời gian chờ connect lần đầu — nhờ vậy
 * `/health/db` với host sai trả `unreachable` nhanh thay vì treo pool.
 */
export function createDbHandle(
  url: string,
  clientOptions?: { connectTimeout?: number },
): DatabaseHandle {
  const client = postgres(url, {
    connect_timeout: clientOptions?.connectTimeout,
  })
  const db = drizzle(client, { schema })
  return {
    db,
    close: (options) => client.end({ timeout: options?.timeout ?? 5 }).then(() => undefined),
  }
}

/** Tạo Drizzle DB instance từ connection string (backward compatible). */
export function createDb(url: string, clientOptions?: { connectTimeout?: number }): Database {
  return createDbHandle(url, clientOptions).db
}
