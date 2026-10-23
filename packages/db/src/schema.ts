/**
 * @marketplace/db — schema Drizzle ORM (PostgreSQL).
 * Schema tối thiểu cho marketplace: users + components.
 * Better Auth (tích hợp sau) sẽ tái dùng bảng users hoặc thêm bảng riêng.
 */

import { boolean, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'

export const userRole = pgEnum('user_role', ['user', 'seller', 'admin'])

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: text('email').notNull(),
    name: text('name').notNull(),
    // 2 field lõi của Better Auth "user" model (ghép sau bằng drizzleAdapter,
    // modelName 'users' / usePlural). emailVerified mặc định false.
    emailVerified: boolean('email_verified').notNull().default(false),
    image: text('image'),
    // App-owned field: thêm vào auth config qua user.additionalFields (input: false)
    role: userRole('role').notNull().default('user'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('users_email_unique').on(table.email)],
)

export const components = pgTable(
  'components',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    category: text('category').notNull().default('general'),
    tags: text('tags').array().notNull().default([]),
    latestVersion: text('latest_version').notNull().default('0.0.0'),
    isPublished: boolean('is_published').notNull().default(false),
    authorId: uuid('author_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('components_slug_unique').on(table.slug)],
)

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Component = typeof components.$inferSelect
export type NewComponent = typeof components.$inferInsert
