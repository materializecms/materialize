import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

/**
 * Content is stored as validated JSON: the schema lives in code, so changing fields never needs a migration.
 * `data` is the working draft; `publishedData` is what the live site serves.
 */
export const documents = sqliteTable(
  'documents',
  {
    id: text('id').primaryKey(),
    collection: text('collection').notNull(),
    locale: text('locale').notNull(),
    slug: text('slug'),
    title: text('title').notNull(),
    data: text('data', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),
    publishedData: text('published_data', { mode: 'json' }).$type<Record<string, unknown>>(),
    hasChanges: integer('has_changes', { mode: 'boolean' }).notNull().default(true),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
    publishedAt: integer('published_at', { mode: 'timestamp_ms' }),
    createdBy: text('created_by'),
    updatedBy: text('updated_by'),
  },
  (t) => [
    uniqueIndex('documents_slug_unique').on(t.collection, t.locale, t.slug),
    index('documents_list').on(t.collection, t.locale, t.updatedAt),
  ],
)

export const revisions = sqliteTable(
  'revisions',
  {
    id: text('id').primaryKey(),
    documentId: text('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: ['save', 'publish', 'restore'] }).notNull(),
    data: text('data', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    authorId: text('author_id'),
  },
  (t) => [index('revisions_document').on(t.documentId, t.createdAt)],
)

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  role: text('role', { enum: ['admin', 'editor'] }).notNull(),
  passwordHash: text('password_hash').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  lastSeenAt: integer('last_seen_at', { mode: 'timestamp_ms' }),
})

/** Only a SHA-256 hash of each session token is stored. */
export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
})

/**
 * One-time links: an invitation to join, or a password reset for an existing user.
 * Like sessions, only a hash of the token is stored.
 */
export const invites = sqliteTable('invites', {
  id: text('id').primaryKey(),
  kind: text('kind', { enum: ['invite', 'reset'] }).notNull(),
  email: text('email').notNull(),
  name: text('name').notNull().default(''),
  role: text('role', { enum: ['admin', 'editor'] }).notNull(),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
  createdBy: text('created_by'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
})

/** Site-wide settings edited in the panel, such as the design theme. One JSON value per key. */
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value', { mode: 'json' }).$type<unknown>().notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  updatedBy: text('updated_by'),
})

/** Uploaded files. The file lives in storage under `key`; documents reference it as `/media/<key>`. */
export const media = sqliteTable(
  'media',
  {
    id: text('id').primaryKey(),
    key: text('key').notNull().unique(),
    filename: text('filename').notNull(),
    mime: text('mime').notNull(),
    size: integer('size').notNull(),
    width: integer('width'),
    height: integer('height'),
    alt: text('alt').notNull().default(''),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    createdBy: text('created_by'),
  },
  (t) => [index('media_created').on(t.createdAt)],
)

/** Messages sent from forms on the site, with what was filled in. */
export const submissions = sqliteTable(
  'submissions',
  {
    id: text('id').primaryKey(),
    form: text('form').notNull(),
    page: text('page').notNull().default(''),
    data: text('data', { mode: 'json' }).$type<Record<string, string>>().notNull(),
    read: integer('read', { mode: 'boolean' }).notNull().default(false),
    mailed: integer('mailed', { mode: 'boolean' }).notNull().default(false),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => [index('submissions_created').on(t.createdAt)],
)

/** Notes left on a page in the editor, pinned to an element or to the whole page. */
export const comments = sqliteTable(
  'comments',
  {
    id: text('id').primaryKey(),
    documentId: text('document_id').notNull(),
    nodeId: text('node_id'),
    authorId: text('author_id'),
    authorName: text('author_name').notNull().default(''),
    body: text('body').notNull(),
    resolved: integer('resolved', { mode: 'boolean' }).notNull().default(false),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => [index('comments_document').on(t.documentId)],
)

/** Plain DDL applied on startup; versioned so later releases can add steps. */
export const MIGRATIONS: string[][] = [
  [
    `CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      collection TEXT NOT NULL,
      locale TEXT NOT NULL,
      slug TEXT,
      title TEXT NOT NULL,
      data TEXT NOT NULL,
      published_data TEXT,
      has_changes INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      published_at INTEGER,
      created_by TEXT,
      updated_by TEXT
    )`,
    'CREATE UNIQUE INDEX IF NOT EXISTS documents_slug_unique ON documents (collection, locale, slug)',
    'CREATE INDEX IF NOT EXISTS documents_list ON documents (collection, locale, updated_at)',
    `CREATE TABLE IF NOT EXISTS revisions (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      author_id TEXT
    )`,
    'CREATE INDEX IF NOT EXISTS revisions_document ON revisions (document_id, created_at)',
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    )`,
  ],
  [
    `CREATE TABLE IF NOT EXISTS media (
      id TEXT PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      filename TEXT NOT NULL,
      mime TEXT NOT NULL,
      size INTEGER NOT NULL,
      width INTEGER,
      height INTEGER,
      alt TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      created_by TEXT
    )`,
    'CREATE INDEX IF NOT EXISTS media_created ON media (created_at)',
  ],
  [
    `CREATE TABLE IF NOT EXISTS invites (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      email TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      created_by TEXT,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    )`,
  ],
  [
    'ALTER TABLE users ADD COLUMN last_seen_at INTEGER',
    // Before this column, sign-ins were only visible through the sessions still open.
    'UPDATE users SET last_seen_at = (SELECT MAX(created_at) FROM sessions WHERE sessions.user_id = users.id)',
  ],
  [
    `CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      updated_by TEXT
    )`,
  ],
  [
    `CREATE TABLE IF NOT EXISTS submissions (
      id TEXT PRIMARY KEY,
      form TEXT NOT NULL,
      page TEXT NOT NULL DEFAULT '',
      data TEXT NOT NULL,
      read INTEGER NOT NULL DEFAULT 0,
      mailed INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    )`,
    'CREATE INDEX IF NOT EXISTS submissions_created ON submissions (created_at)',
  ],
  [
    `CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      node_id TEXT,
      author_id TEXT,
      author_name TEXT NOT NULL DEFAULT '',
      body TEXT NOT NULL,
      resolved INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    )`,
    'CREATE INDEX IF NOT EXISTS comments_document ON comments (document_id)',
  ],
]
