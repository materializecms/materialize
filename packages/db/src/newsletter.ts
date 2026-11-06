import { randomBytes, randomUUID } from 'node:crypto'
import { and, asc, count, desc, eq, inArray, isNotNull, like, lte, or, sql } from 'drizzle-orm'
import type { Db } from './database.ts'
import { newsletterSends, newsletters, subscribers } from './tables.ts'

export type SubscriberStatus = 'pending' | 'active' | 'unsubscribed'

export interface Subscriber {
  id: string
  email: string
  name: string
  status: SubscriberStatus
  locale: string | null
  source: string
  token: string
  createdAt: Date
  confirmedAt: Date | null
  unsubscribedAt: Date | null
}

export type NewsletterStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed'

export interface Newsletter {
  id: string
  subject: string
  preheader: string
  body: unknown[]
  status: NewsletterStatus
  runAt: Date | null
  error: string | null
  createdBy: string | null
  createdByName: string
  createdAt: Date
  updatedAt: Date
  sentAt: Date | null
}

export interface NewsletterStats {
  total: number
  sent: number
  failed: number
  pending: number
  opened: number
  clicked: number
  unsubscribed: number
}

const token = () => randomBytes(18).toString('base64url')

const subscriber = (r: typeof subscribers.$inferSelect): Subscriber => ({
  ...r,
  locale: r.locale ?? null,
  confirmedAt: r.confirmedAt ?? null,
  unsubscribedAt: r.unsubscribedAt ?? null,
})

const letter = (r: typeof newsletters.$inferSelect): Newsletter => ({
  ...r,
  runAt: r.runAt ?? null,
  error: r.error ?? null,
  createdBy: r.createdBy ?? null,
  sentAt: r.sentAt ?? null,
})

/** The newsletter: who receives it, what is sent, and how each send went. */
export function createNewsletterStore(db: Db) {
  const store = {
    // ---------- subscribers ----------

    /**
     * Someone asks to receive the newsletter. A new address (or one that left) waits for its
     * confirmation; an active one stays as it is. The caller sends the confirmation email when
     * `confirm` is true.
     */
    async subscribe(input: {
      email: string
      name?: string
      locale?: string | null
      source: string
    }): Promise<{ subscriber: Subscriber; confirm: boolean }> {
      const email = input.email.trim().toLowerCase()
      const found = await db.query.subscribers.findFirst({ where: eq(subscribers.email, email) })
      if (found?.status === 'active') return { subscriber: subscriber(found), confirm: false }
      if (found) {
        await db
          .update(subscribers)
          .set({
            status: 'pending',
            name: input.name?.trim() || found.name,
            locale: input.locale ?? found.locale,
            source: input.source,
            unsubscribedAt: null,
          })
          .where(eq(subscribers.id, found.id))
        return { subscriber: (await store.subscriber(found.id)) as Subscriber, confirm: true }
      }
      const row = {
        id: randomUUID(),
        email,
        name: input.name?.trim() ?? '',
        status: 'pending' as const,
        locale: input.locale ?? null,
        source: input.source,
        token: token(),
        createdAt: new Date(),
        confirmedAt: null,
        unsubscribedAt: null,
      }
      await db.insert(subscribers).values(row)
      return { subscriber: row, confirm: true }
    },

    async subscriber(id: string): Promise<Subscriber | null> {
      const r = await db.query.subscribers.findFirst({ where: eq(subscribers.id, id) })
      return r ? subscriber(r) : null
    },

    async byToken(value: string): Promise<Subscriber | null> {
      const r = await db.query.subscribers.findFirst({ where: eq(subscribers.token, value) })
      return r ? subscriber(r) : null
    },

    /** The confirmation link: pending becomes active. One who had left must sign up again. */
    async confirm(value: string): Promise<Subscriber | null> {
      const found = await store.byToken(value)
      if (!found || found.status === 'unsubscribed') return null
      if (found.status === 'pending')
        await db
          .update(subscribers)
          .set({ status: 'active', confirmedAt: new Date() })
          .where(eq(subscribers.id, found.id))
      return store.subscriber(found.id)
    },

    /** Leaves the newsletter for good (until they sign up again). */
    async unsubscribe(id: string): Promise<void> {
      await db
        .update(subscribers)
        .set({ status: 'unsubscribed', unsubscribedAt: new Date() })
        .where(eq(subscribers.id, id))
    },

    async removeSubscriber(id: string): Promise<void> {
      await db.delete(subscribers).where(eq(subscribers.id, id))
      await db.delete(newsletterSends).where(eq(newsletterSends.subscriberId, id))
    },

    async subscribers(options: {
      status?: SubscriberStatus
      search?: string
      limit?: number
      offset?: number
    }): Promise<{ items: Subscriber[]; total: number; counts: Record<SubscriberStatus, number> }> {
      const where = and(
        options.status ? eq(subscribers.status, options.status) : undefined,
        options.search
          ? or(
              like(subscribers.email, `%${options.search.replace(/[%_]/g, '')}%`),
              like(subscribers.name, `%${options.search.replace(/[%_]/g, '')}%`),
            )
          : undefined,
      )
      const items = await db
        .select()
        .from(subscribers)
        .where(where)
        .orderBy(desc(subscribers.createdAt))
        .limit(options.limit ?? 50)
        .offset(options.offset ?? 0)
      const [total] = await db.select({ n: count() }).from(subscribers).where(where)
      const rows = await db
        .select({ status: subscribers.status, n: count() })
        .from(subscribers)
        .groupBy(subscribers.status)
      const counts = { pending: 0, active: 0, unsubscribed: 0 }
      for (const r of rows) counts[r.status] = r.n
      return { items: items.map(subscriber), total: total?.n ?? 0, counts }
    },

    /** Everyone, for the export. */
    async allSubscribers(): Promise<Subscriber[]> {
      return (await db.select().from(subscribers).orderBy(asc(subscribers.createdAt))).map(subscriber)
    },

    /**
     * Addresses brought from another service, as active: their consent was asked there. Those
     * who left this newsletter stay out, and active ones are left as they are.
     */
    async importMany(
      rows: { email: string; name?: string }[],
    ): Promise<{ added: number; skipped: number; unsubscribed: number }> {
      let added = 0
      let skipped = 0
      let left = 0
      for (const r of rows) {
        const email = r.email.trim().toLowerCase()
        const found = await db.query.subscribers.findFirst({ where: eq(subscribers.email, email) })
        if (found?.status === 'unsubscribed') left++
        else if (found?.status === 'active') skipped++
        else if (found) {
          await db
            .update(subscribers)
            .set({ status: 'active', confirmedAt: new Date(), source: 'import' })
            .where(eq(subscribers.id, found.id))
          added++
        } else {
          await db.insert(subscribers).values({
            id: randomUUID(),
            email,
            name: r.name?.trim() ?? '',
            status: 'active',
            locale: null,
            source: 'import',
            token: token(),
            createdAt: new Date(),
            confirmedAt: new Date(),
          })
          added++
        }
      }
      return { added, skipped, unsubscribed: left }
    },

    /** Unconfirmed signups older than the given date: forgotten, so dropped. */
    async dropUnconfirmed(before: Date): Promise<number> {
      const old = await db
        .select({ id: subscribers.id })
        .from(subscribers)
        .where(and(eq(subscribers.status, 'pending'), lte(subscribers.createdAt, before)))
      if (old.length)
        await db.delete(subscribers).where(
          inArray(
            subscribers.id,
            old.map((o) => o.id),
          ),
        )
      return old.length
    },

    // ---------- newsletters ----------

    async create(input: {
      subject: string
      preheader?: string
      body?: unknown[]
      user: { id: string; name: string }
    }): Promise<Newsletter> {
      const now = new Date()
      const row = {
        id: randomUUID(),
        subject: input.subject,
        preheader: input.preheader ?? '',
        body: input.body ?? [],
        status: 'draft' as const,
        runAt: null,
        error: null,
        createdBy: input.user.id,
        createdByName: input.user.name,
        createdAt: now,
        updatedAt: now,
        sentAt: null,
      }
      await db.insert(newsletters).values(row)
      return row
    },

    async get(id: string): Promise<Newsletter | null> {
      const r = await db.query.newsletters.findFirst({ where: eq(newsletters.id, id) })
      return r ? letter(r) : null
    },

    async list(): Promise<Newsletter[]> {
      return (await db.select().from(newsletters).orderBy(desc(newsletters.updatedAt)).limit(200)).map(letter)
    },

    async update(id: string, input: { subject?: string; preheader?: string; body?: unknown[] }): Promise<void> {
      await db
        .update(newsletters)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(newsletters.id, id))
    },

    async remove(id: string): Promise<void> {
      await db.delete(newsletters).where(eq(newsletters.id, id))
      await db.delete(newsletterSends).where(eq(newsletterSends.newsletterId, id))
    },

    async setStatus(
      id: string,
      status: NewsletterStatus,
      extra: { runAt?: Date | null; error?: string | null; sentAt?: Date | null } = {},
    ): Promise<void> {
      await db
        .update(newsletters)
        .set({ status, ...extra })
        .where(eq(newsletters.id, id))
    },

    /** Scheduled newsletters whose time has come, and the ones a stopped server left halfway. */
    async due(now: Date): Promise<Newsletter[]> {
      return (
        await db
          .select()
          .from(newsletters)
          .where(
            or(
              eq(newsletters.status, 'sending'),
              and(eq(newsletters.status, 'scheduled'), isNotNull(newsletters.runAt), lte(newsletters.runAt, now)),
            ),
          )
          .orderBy(asc(newsletters.runAt))
      ).map(letter)
    },

    // ---------- sends ----------

    /** One pending send for every active subscriber who has none yet for this newsletter. */
    async prepare(newsletterId: string): Promise<number> {
      const active = await db
        .select({ id: subscribers.id, email: subscribers.email })
        .from(subscribers)
        .where(eq(subscribers.status, 'active'))
      for (const s of active)
        await db
          .insert(newsletterSends)
          .values({ id: randomUUID(), newsletterId, subscriberId: s.id, email: s.email, status: 'pending' })
          .onConflictDoNothing()
      return active.length
    },

    async pending(newsletterId: string, limit: number) {
      return db
        .select()
        .from(newsletterSends)
        .where(and(eq(newsletterSends.newsletterId, newsletterId), eq(newsletterSends.status, 'pending')))
        .limit(limit)
    },

    async markSend(id: string, status: 'sent' | 'failed', error: string | null = null): Promise<void> {
      await db
        .update(newsletterSends)
        .set({ status, error, sentAt: status === 'sent' ? new Date() : null })
        .where(eq(newsletterSends.id, id))
    },

    async send(id: string) {
      return (await db.query.newsletterSends.findFirst({ where: eq(newsletterSends.id, id) })) ?? null
    },

    /** The first time a send is opened (the picture in the email) or one of its links is followed. */
    async track(id: string, what: 'open' | 'click' | 'unsubscribe'): Promise<void> {
      const now = new Date()
      const column =
        what === 'open'
          ? newsletterSends.openedAt
          : what === 'click'
            ? newsletterSends.clickedAt
            : newsletterSends.unsubscribedAt
      const set = what === 'open' ? { openedAt: now } : what === 'click' ? { clickedAt: now } : { unsubscribedAt: now }
      await db
        .update(newsletterSends)
        .set(set)
        .where(and(eq(newsletterSends.id, id), sql`${column} is null`))
      // A click means the email was opened, even when its pictures were blocked.
      if (what === 'click')
        await db
          .update(newsletterSends)
          .set({ openedAt: now })
          .where(and(eq(newsletterSends.id, id), sql`${newsletterSends.openedAt} is null`))
    },

    async stats(newsletterId: string): Promise<NewsletterStats> {
      const [r] = await db
        .select({
          total: count(),
          sent: sql<number>`sum(case when ${newsletterSends.status} = 'sent' then 1 else 0 end)`,
          failed: sql<number>`sum(case when ${newsletterSends.status} = 'failed' then 1 else 0 end)`,
          pending: sql<number>`sum(case when ${newsletterSends.status} = 'pending' then 1 else 0 end)`,
          opened: sql<number>`sum(case when ${newsletterSends.openedAt} is not null then 1 else 0 end)`,
          clicked: sql<number>`sum(case when ${newsletterSends.clickedAt} is not null then 1 else 0 end)`,
          unsubscribed: sql<number>`sum(case when ${newsletterSends.unsubscribedAt} is not null then 1 else 0 end)`,
        })
        .from(newsletterSends)
        .where(eq(newsletterSends.newsletterId, newsletterId))
      const n = (v: unknown) => Number(v ?? 0)
      return {
        total: n(r?.total),
        sent: n(r?.sent),
        failed: n(r?.failed),
        pending: n(r?.pending),
        opened: n(r?.opened),
        clicked: n(r?.clicked),
        unsubscribed: n(r?.unsubscribed),
      }
    },
  }
  return store
}

export type NewsletterStore = ReturnType<typeof createNewsletterStore>
