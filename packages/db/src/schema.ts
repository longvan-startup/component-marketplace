/**
 * @marketplace/db — schema Drizzle ORM (PostgreSQL).
 * Schema marketplace + Better Auth. Auth dùng lại users; session, account,
 * verification là các bảng riêng do Better Auth quản lý.
 */

import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

export const userRole = pgEnum('user_role', ['user', 'seller', 'admin'])
export const catalogCategory = pgEnum('catalog_category', ['animation', 'react-component', 'tool'])
export const componentAccessTier = pgEnum('component_access_tier', ['free', 'pro'])

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    // Keep canonical lowercase at the database boundary; the functional unique
    // index also protects uniqueness if a writer bypasses the trigger.
    email: text('email').notNull(),
    name: text('name').notNull(),
    // Các field lõi của Better Auth user model. emailVerified mặc định false.
    emailVerified: boolean('email_verified').notNull().default(false),
    image: text('image'),
    // App-owned field: thêm vào auth config qua user.additionalFields (input: false)
    role: userRole('role').notNull().default('user'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    // The users_integrity_before_write trigger refreshes this on every update.
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('users_email_lower_unique').on(sql`lower(${table.email})`)],
)

export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    token: text('token').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (table) => [
    uniqueIndex('sessions_token_unique').on(table.token),
    index('sessions_user_id_idx').on(table.userId),
  ],
)

export const accounts = pgTable(
  'accounts',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('accounts_user_id_idx').on(table.userId),
    uniqueIndex('accounts_provider_account_unique').on(table.providerId, table.accountId),
  ],
)

export const verifications = pgTable(
  'verifications',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('verifications_identifier_idx').on(table.identifier)],
)

export const components = pgTable(
  'components',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    category: catalogCategory('category').notNull(),
    tags: varchar('tags', { length: 40 }).array().notNull().default([]),
    latestVersion: text('latest_version').notNull().default('0.0.0'),
    isPublished: boolean('is_published').notNull().default(false),
    // Catalog price in minor currency units; NULL means no price is configured.
    priceAmountMinor: integer('price_amount_minor'),
    priceCurrency: varchar('price_currency', { length: 3 }),
    requiresPaymentForUpdate: boolean('requires_payment_for_update').notNull().default(false),
    // Membership label. Independent of the legacy price columns.
    accessTier: componentAccessTier('access_tier').notNull().default('free'),
    authorId: uuid('author_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('components_slug_unique').on(table.slug),
    index('components_tags_gin_idx').using('gin', table.tags),
    check(
      'components_slug_format_check',
      sql`${table.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(${table.slug}) <= 80`,
    ),
    check('components_name_length_check', sql`char_length(${table.name}) BETWEEN 1 AND 120`),
    check(
      'components_description_length_check',
      sql`${table.description} IS NULL OR char_length(${table.description}) <= 5000`,
    ),
    check(
      'components_tags_count_check',
      sql`cardinality(${table.tags}) <= 12 AND coalesce(array_ndims(${table.tags}), 0) <= 1 AND array_position(${table.tags}, '') IS NULL AND array_position(${table.tags}, NULL) IS NULL`,
    ),
    check(
      'components_latest_version_check',
      sql`${table.latestVersion} ~ '^[0-9]+\\.[0-9]+\\.[0-9]+$'`,
    ),
    check(
      'components_price_amount_check',
      sql`${table.priceAmountMinor} IS NULL OR ${table.priceAmountMinor} > 0`,
    ),
    check(
      'components_price_currency_check',
      sql`${table.priceCurrency} IS NULL OR ${table.priceCurrency} ~ '^[A-Z]{3}$'`,
    ),
    check(
      'components_price_pair_check',
      sql`(${table.priceAmountMinor} IS NULL) = (${table.priceCurrency} IS NULL)`,
    ),
    check(
      'components_paid_update_price_check',
      sql`NOT ${table.requiresPaymentForUpdate} OR ${table.priceAmountMinor} IS NOT NULL`,
    ),
  ],
)

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Component = typeof components.$inferSelect
export type NewComponent = typeof components.$inferInsert
