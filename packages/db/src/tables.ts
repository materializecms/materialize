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
    /** The document this one translates (in the site's main language); null for originals. */
    sourceId: text('source_id'),
  },
  (t) => [
    uniqueIndex('documents_slug_unique').on(t.collection, t.locale, t.slug),
    index('documents_list').on(t.collection, t.locale, t.updatedAt),
    index('documents_source').on(t.sourceId),
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
  /** Two-step verification: the authenticator app's secret, once confirmed. */
  totpSecret: text('totp_secret'),
  /** A secret shown during setup, waiting for its first code. */
  totpPending: text('totp_pending'),
  /** The last time step accepted: a code works once. */
  totpLastStep: integer('totp_last_step'),
  /** Hashes of the unused recovery codes. */
  recoveryCodes: text('recovery_codes', { mode: 'json' }).$type<string[]>(),
})

/** Only a SHA-256 hash of each session token is stored. */
export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  /** Last request: a session left unused for too long ends. */
  lastSeenAt: integer('last_seen_at', { mode: 'timestamp_ms' }),
  /** Which device it is, for the list of connected devices. */
  userAgent: text('user_agent'),
  ip: text('ip'),
})

/** Failed sign-ins, by email and by address: repeated failures lock that key for a while. */
export const loginAttempts = sqliteTable('login_attempts', {
  key: text('key').primaryKey(),
  failures: integer('failures').notNull(),
  lockedUntil: integer('locked_until', { mode: 'timestamp_ms' }),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
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

/**
 * Personal access tokens, for programs acting as a person (an MCP client, a script). Like sessions,
 * only a hash is stored; `hint` keeps the last characters so people can tell them apart.
 */
export const apiTokens = sqliteTable(
  'api_tokens',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    hint: text('hint').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    lastUsedAt: integer('last_used_at', { mode: 'timestamp_ms' }),
  },
  (t) => [index('api_tokens_user').on(t.userId)],
)

/**
 * What happened in the panel, for Impostazioni → Sicurezza: sign-ins, people, publishing,
 * settings. The name is kept as it was, so entries stay readable after someone leaves.
 */
export const activity = sqliteTable(
  'activity',
  {
    id: text('id').primaryKey(),
    at: integer('at', { mode: 'timestamp_ms' }).notNull(),
    userId: text('user_id'),
    userName: text('user_name').notNull().default(''),
    action: text('action').notNull(),
    /** What it was done to: a page's title, a person's email… */
    target: text('target').notNull().default(''),
    detail: text('detail', { mode: 'json' }).$type<Record<string, unknown>>(),
    ip: text('ip'),
  },
  (t) => [index('activity_at').on(t.at), index('activity_action').on(t.action, t.at)],
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
  [
    `CREATE TABLE IF NOT EXISTS api_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      hint TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      last_used_at INTEGER
    )`,
    'CREATE INDEX IF NOT EXISTS api_tokens_user ON api_tokens (user_id)',
  ],
  [
    'ALTER TABLE documents ADD COLUMN source_id TEXT',
    'CREATE INDEX IF NOT EXISTS documents_source ON documents (source_id)',
  ],
  [
    'ALTER TABLE users ADD COLUMN totp_secret TEXT',
    'ALTER TABLE users ADD COLUMN totp_pending TEXT',
    'ALTER TABLE users ADD COLUMN totp_last_step INTEGER',
    'ALTER TABLE users ADD COLUMN recovery_codes TEXT',
    'ALTER TABLE sessions ADD COLUMN last_seen_at INTEGER',
    'ALTER TABLE sessions ADD COLUMN user_agent TEXT',
    'ALTER TABLE sessions ADD COLUMN ip TEXT',
    `CREATE TABLE IF NOT EXISTS login_attempts (
      key TEXT PRIMARY KEY,
      failures INTEGER NOT NULL,
      locked_until INTEGER,
      updated_at INTEGER NOT NULL
    )`,
  ],
  [
    `CREATE TABLE IF NOT EXISTS activity (
      id TEXT PRIMARY KEY,
      at INTEGER NOT NULL,
      user_id TEXT,
      user_name TEXT NOT NULL DEFAULT '',
      action TEXT NOT NULL,
      target TEXT NOT NULL DEFAULT '',
      detail TEXT,
      ip TEXT
    )`,
    'CREATE INDEX IF NOT EXISTS activity_at ON activity (at)',
    'CREATE INDEX IF NOT EXISTS activity_action ON activity (action, at)',
  ],
]
