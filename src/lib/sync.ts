import { and, eq } from "drizzle-orm";
import { db } from "#/db";
import { accounts, categories, rules, transactions } from "#/db/schema";
import type { Rule } from "#/db/schema";
import { categoryForMcc } from "#/lib/mcc-categories";
import { getStatement } from "#/lib/monobank/client";
import type { StatementItem } from "#/lib/monobank/types";
import { findMatchingRule } from "#/lib/rules";

const STATEMENT_WINDOW_MS = 31 * 24 * 60 * 60 * 1000;
const DEFAULT_RATE_LIMIT_MS = 60 * 1000;
const DEFAULT_INITIAL_LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000;
const STATEMENT_PAGE_LIMIT = 500;

type Logger = (message: string) => void;

export type SyncOptions = {
  initialLookbackMs?: number;
  rateLimitMs?: number;
  log?: Logger;
  now?: () => Date;
};

export type SyncResult = {
  accountId: number;
  inserted: number;
  fetched: number;
  rangeFrom: Date;
  rangeTo: Date;
  apiCalls: number;
};

export async function syncMonoAccount(
  accountId: number,
  options: SyncOptions = {},
): Promise<SyncResult> {
  const log = options.log ?? (() => {});
  const now = options.now ?? (() => new Date());
  const rateLimitMs = options.rateLimitMs ?? DEFAULT_RATE_LIMIT_MS;
  const initialLookbackMs =
    options.initialLookbackMs ?? DEFAULT_INITIAL_LOOKBACK_MS;

  const account = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .get();
  if (!account) throw new Error(`Account ${accountId} not found`);
  if (account.type !== "mono" || !account.monoAccountId) {
    throw new Error(`Account ${accountId} is not a Mono account`);
  }

  const resolveCategoryId = createCategoryResolver(account.userId);
  const userRules = await db
    .select()
    .from(rules)
    .where(eq(rules.userId, account.userId))
    .all();

  const endDate = now();
  const startDate = account.lastSyncedAt
    ? new Date(account.lastSyncedAt.getTime() + 1000)
    : new Date(endDate.getTime() - initialLookbackMs);

  if (startDate.getTime() >= endDate.getTime()) {
    log(`Nothing to sync (already up to date).`);
    return {
      accountId,
      inserted: 0,
      fetched: 0,
      rangeFrom: startDate,
      rangeTo: endDate,
      apiCalls: 0,
    };
  }

  log(
    `Syncing account #${account.id} "${account.name}" (mono ${account.monoAccountId}) for user ${account.userId}`,
  );
  log(
    `Range: ${startDate.toISOString()} -> ${endDate.toISOString()} (${formatDuration(
      endDate.getTime() - startDate.getTime(),
    )})`,
  );
  log(
    `lastSyncedAt before: ${
      account.lastSyncedAt ? account.lastSyncedAt.toISOString() : "<never>"
    }`,
  );

  let cursorEnd = endDate.getTime();
  const cursorStartBound = startDate.getTime();
  let apiCalls = 0;
  let fetched = 0;
  let inserted = 0;
  let highestTxTime = account.lastSyncedAt?.getTime() ?? 0;

  while (cursorEnd > cursorStartBound) {
    if (apiCalls > 0) {
      log(`Sleeping ${rateLimitMs}ms for Mono rate limit...`);
      await sleep(rateLimitMs);
    }
    const windowStart = Math.max(
      cursorStartBound,
      cursorEnd - STATEMENT_WINDOW_MS,
    );

    log(
      `GET /personal/statement window ${new Date(
        windowStart,
      ).toISOString()} -> ${new Date(cursorEnd).toISOString()}`,
    );
    const t0 = Date.now();
    const page = await getStatement(
      account.monoAccountId,
      new Date(windowStart),
      new Date(cursorEnd),
    );
    const elapsed = Date.now() - t0;
    apiCalls += 1;
    fetched += page.length;
    log(
      `  fetched ${page.length} item(s) in ${elapsed}ms${
        page.length === STATEMENT_PAGE_LIMIT ? " (page full, will paginate)" : ""
      }`,
    );

    if (page.length > 0) {
      const newRows = await persistPage(
        account.userId,
        account.id,
        page,
        resolveCategoryId,
        userRules,
      );
      inserted += newRows;
      log(
        `  inserted ${newRows} new row(s) (${page.length - newRows} skipped as duplicate)`,
      );
      const oldest = page[page.length - 1];
      const newest = page[0];
      highestTxTime = Math.max(highestTxTime, newest.time * 1000);
      if (page.length === STATEMENT_PAGE_LIMIT) {
        cursorEnd = oldest.time * 1000 - 1;
        continue;
      }
    }
    cursorEnd = windowStart - 1;
  }

  const newLastSyncedAt = new Date(
    highestTxTime > 0 ? highestTxTime : endDate.getTime(),
  );
  await db
    .update(accounts)
    .set({ lastSyncedAt: newLastSyncedAt })
    .where(eq(accounts.id, accountId));

  log(
    `Done. ${inserted} inserted, ${fetched} fetched, ${apiCalls} API call(s). lastSyncedAt=${newLastSyncedAt.toISOString()}`,
  );

  return {
    accountId,
    inserted,
    fetched,
    rangeFrom: startDate,
    rangeTo: endDate,
    apiCalls,
  };
}

async function persistPage(
  userId: number,
  accountId: number,
  page: Array<StatementItem>,
  resolveCategoryId: (name: string) => Promise<number>,
  userRules: ReadonlyArray<Rule>,
): Promise<number> {
  const rows = await Promise.all(
    page.map(async (item) => {
      const description = buildDescription(item);
      const counterIban = item.counterIban ?? null;
      const matchedRule = findMatchingRule(userRules, {
        mcc: item.mcc,
        counterIban,
        description,
      });
      const categoryId = matchedRule
        ? matchedRule.categoryId
        : await resolveCategoryId(categoryForMcc(item.mcc, item.amount));
      const amount = item.amount / 100;
      return {
        userId,
        accountId,
        categoryId,
        description,
        amount,
        originalCategoryId: categoryId,
        originalDescription: description,
        originalAmount: amount,
        mcc: item.mcc,
        counterIban,
        counterName: item.counterName ?? null,
        monoTxId: item.id,
        createdAt: new Date(item.time * 1000),
      };
    }),
  );
  const result = await db
    .insert(transactions)
    .values(rows)
    .onConflictDoNothing({
      target: [transactions.accountId, transactions.monoTxId],
    })
    .returning({ id: transactions.id });
  return result.length;
}

function buildDescription(item: StatementItem) {
  if (item.comment && item.comment.trim()) {
    return `${item.description} — ${item.comment.trim()}`;
  }
  return item.description;
}

function createCategoryResolver(userId: number) {
  const cache = new Map<string, Promise<number>>();
  return function resolveCategoryId(name: string): Promise<number> {
    const cached = cache.get(name);
    if (cached) return cached;
    const promise = (async () => {
      const existing = await db
        .select({ id: categories.id })
        .from(categories)
        .where(and(eq(categories.userId, userId), eq(categories.name, name)))
        .get();
      if (existing) return existing.id;
      const created = await db
        .insert(categories)
        .values({ userId, name })
        .returning({ id: categories.id })
        .get();
      return created.id;
    })();
    cache.set(name, promise);
    return promise;
  };
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function formatDuration(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}
