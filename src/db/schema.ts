import {
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
};

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
});

export const ACCOUNT_TYPES = ["cash", "mono"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const accounts = sqliteTable("accounts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type", { enum: ACCOUNT_TYPES }).notNull().default("cash"),
  monoAccountId: text("mono_account_id"),
  lastSyncedAt: integer("last_synced_at", { mode: "timestamp" }),
  ...timestamps,
});

export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  ...timestamps,
});

export const transactions = sqliteTable(
  "transactions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: integer("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "restrict" }),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    description: text("description").notNull(),
    amount: real("amount").notNull(),
    originalCategoryId: integer("original_category_id").references(
      () => categories.id,
      { onDelete: "set null" },
    ),
    originalDescription: text("original_description"),
    originalAmount: real("original_amount"),
    mcc: integer("mcc"),
    counterIban: text("counter_iban"),
    counterName: text("counter_name"),
    monoTxId: text("mono_tx_id"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("transactions_account_mono_tx_unique").on(
      table.accountId,
      table.monoTxId,
    ),
  ],
);

export const rules = sqliteTable("rules", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  categoryId: integer("category_id")
    .notNull()
    .references(() => categories.id, { onDelete: "cascade" }),
  mcc: integer("mcc"),
  counterIban: text("counter_iban"),
  descriptionPattern: text("description_pattern"),
  ...timestamps,
});

export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type Rule = typeof rules.$inferSelect;
