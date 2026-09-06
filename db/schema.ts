import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';

// One private ledger per authenticated owner; prior revisions are immutable.
export const ledgers = sqliteTable('ledgers', {
  ownerId: text('owner_id').primaryKey(),
  revision: integer('revision').notNull().default(0),
  payload: text('payload').notNull(),
  updatedAt: text('updated_at').notNull(),
});
export const ledgerHistory = sqliteTable('ledger_history', {
  ownerId: text('owner_id').notNull(),
  revision: integer('revision').notNull(),
  payload: text('payload').notNull(),
  savedAt: text('saved_at').notNull(),
}, t => [primaryKey({ columns: [t.ownerId, t.revision] })]);
