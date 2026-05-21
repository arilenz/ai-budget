import type { Rule } from "#/db/schema";

export type RuleTarget = {
  mcc: number | null;
  counterIban: string | null;
  description: string;
};

export type InferredRuleConditions = {
  mcc: number | null;
  counterIban: string | null;
  descriptionPattern: string | null;
};

export function normalizeDescription(value: string | null | undefined): string {
  if (!value) return "";
  return value.toLowerCase().trim();
}

function countConditions(rule: {
  mcc: number | null;
  counterIban: string | null;
  descriptionPattern: string | null;
}): number {
  return (
    (rule.mcc !== null ? 1 : 0) +
    (rule.counterIban !== null ? 1 : 0) +
    (rule.descriptionPattern !== null ? 1 : 0)
  );
}

export function ruleMatches(rule: Rule, tx: RuleTarget): boolean {
  if (countConditions(rule) === 0) return false;
  if (rule.mcc !== null && rule.mcc !== tx.mcc) return false;
  if (rule.counterIban !== null && rule.counterIban !== tx.counterIban) {
    return false;
  }
  if (rule.descriptionPattern !== null) {
    const normalized = normalizeDescription(tx.description);
    if (!normalized.includes(rule.descriptionPattern)) return false;
  }
  return true;
}

export function findMatchingRule(
  rules: ReadonlyArray<Rule>,
  tx: RuleTarget,
): Rule | undefined {
  const matches = rules.filter((r) => ruleMatches(r, tx));
  if (matches.length === 0) return undefined;
  return matches.reduce((best, current) => {
    const bestSpec = countConditions(best);
    const currentSpec = countConditions(current);
    if (currentSpec !== bestSpec) return currentSpec > bestSpec ? current : best;
    return current.createdAt > best.createdAt ? current : best;
  });
}

export function inferRuleConditions(tx: RuleTarget): InferredRuleConditions {
  if (tx.counterIban) {
    return { mcc: null, counterIban: tx.counterIban, descriptionPattern: null };
  }
  const pattern = normalizeDescription(tx.description) || null;
  if (tx.mcc !== null && tx.mcc !== 0) {
    return { mcc: tx.mcc, counterIban: null, descriptionPattern: pattern };
  }
  return { mcc: null, counterIban: null, descriptionPattern: pattern };
}

