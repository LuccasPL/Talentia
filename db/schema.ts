// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
import {sqliteTable,text,integer,primaryKey} from 'drizzle-orm/sqlite-core';
export const workspaces=sqliteTable('workspaces',{owner:text('owner').primaryKey(),jobs:text('jobs').notNull(),records:text('records').notNull(),version:integer('version').notNull().default(1),updated:text('updated').notNull()});
export const candidates=sqliteTable('candidates',{owner:text('owner').notNull(),id:text('id').notNull(),payload:text('payload').notNull()},t=>[primaryKey({columns:[t.owner,t.id]})]);
