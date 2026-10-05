import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { normalizeRow, type NormalizedCase } from "@/server/import/normalize";
import { parseWorkbook } from "@/server/import/parse";
import { DEFAULT_ALIAS_INDEX } from "@/server/import/topics";

/*
 * Golden test over the real seed workbook. The file is not committed (it is
 * source content, kept in the git-ignored ./data folder), so the suite skips
 * itself when the file is absent.
 */
const SEED = process.env.TAXKATHA_SEED_FILE ?? path.resolve(__dirname, "../data/seed/2026-27_Casewise_Legal_Summaries.xlsx");

describe.skipIf(!existsSync(SEED))("seed workbook: 2026-27 casewise legal summaries", () => {
  const sheet = existsSync(SEED) ? parseWorkbook(readFileSync(SEED)) : null!;
  const results = sheet ? sheet.rows.map((row) => normalizeRow(row, new Date("2026-10-04T00:00:00Z"))) : [];
  const cases = results.map((r) => r.data).filter((d): d is NormalizedCase => d !== null);
  const count = (values: string[]) => values.reduce<Record<string, number>>((acc, v) => ({ ...acc, [v]: (acc[v] ?? 0) + 1 }), {});

  it("finds the header below the title rows and reads every row", () => {
    expect(sheet.sheet).toBe("Case Summaries");
    expect(sheet.headerRow).toBe(4);
    expect(sheet.rows).toHaveLength(670);
    expect(sheet.rows[0]!.rowNumber).toBe(5);
    expect(Object.keys(sheet.columns)).toHaveLength(10);
  });

  it("normalises every row without errors", () => {
    expect(results.filter((r) => r.data === null)).toEqual([]);
    expect(cases).toHaveLength(670);
  });

  it("gives every case a unique identity", () => {
    expect(new Set(cases.map((c) => c.sourceKey)).size).toBe(670);
  });

  it("removes publisher boilerplate but keeps citations to earlier rulings", () => {
    const text = (c: NormalizedCase) => [c.caseName, c.bench, c.caseNumber, c.relevantSections, c.background, c.decision, c.summary].join(" ");
    expect(cases.filter((c) => /©|all rights reserved|taxmann allied/i.test(text(c)))).toEqual([]);
    // "[2025] 170 taxmann.com 123 (SC)" is a law-report citation, not boilerplate.
    expect(cases.some((c) => /taxmann\.com/i.test(text(c)))).toBe(true);
  });

  it("strips citation debris so every headnote starts cleanly", () => {
    const dirty = cases.filter((c) => !/^[A-Z“"'(0-9]/.test(c.summary) || /^[^ ]{0,40}\]/.test(c.summary));
    expect(dirty.map((c) => c.summary.slice(0, 60))).toEqual([]);
    expect(cases.filter((c) => c.domainLabel === "")).toHaveLength(1);
  });

  it("classifies tax areas", () => {
    expect(count(cases.map((c) => c.domain))).toEqual({ gst: 663, vat: 3, excise: 2, ibc: 1, other: 1 });
  });

  it("normalises outcomes", () => {
    expect(count(cases.map((c) => `${c.outcomeSide}${c.remanded ? "+remanded" : ""}`))).toEqual({
      assessee: 334,
      "assessee+remanded": 123,
      revenue: 173,
      "revenue+remanded": 3,
      unknown: 37,
    });
  });

  it("merges court name variants", () => {
    expect(new Set(sheet.rows.map((r) => String(r.cells.court))).size).toBe(68);
    expect(new Set(cases.map((c) => c.court.key)).size).toBe(50);
    expect(count(cases.map((c) => c.court.type))).toEqual({
      high_court: 537,
      gstat: 89,
      supreme_court: 24,
      aar: 14,
      aaar: 5,
      tribunal: 1,
    });
  });

  it("maps topic labels onto the curated taxonomy", () => {
    const curated = cases.filter((c) => c.topicKey && DEFAULT_ALIAS_INDEX.has(c.topicKey));
    expect(curated.length).toBeGreaterThanOrEqual(660);
    const unknown = cases.filter((c) => c.topicKey && !DEFAULT_ALIAS_INDEX.has(c.topicKey)).map((c) => c.topicLabel);
    expect(unknown).toEqual(["Method Of recruitment, age limit, other qualification, etc."]);
  });

  it("parses section references for nearly every case", () => {
    expect(cases.filter((c) => c.sectionRefs.length > 0).length).toBeGreaterThanOrEqual(660);
    const refs = count(cases.flatMap((c) => c.sectionRefs));
    expect(refs["CGST S.73"]).toBeGreaterThan(120);
    expect(refs["CGST S.74"]).toBeGreaterThan(100);
    expect(refs["Constitution Art.226"]).toBeGreaterThan(20);
  });

  it("keeps decision dates within the file's period", () => {
    const dates = cases.map((c) => c.decisionDate).sort();
    expect(dates[0]).toBe("2026-06-01");
    expect(dates.at(-1)).toBe("2026-09-29");
  });

  it("is deterministic: the same row always hashes the same", () => {
    const again = sheet.rows.map((row) => normalizeRow(row, new Date("2026-10-04T00:00:00Z")).data!);
    expect(again.map((c) => c.contentHash)).toEqual(cases.map((c) => c.contentHash));
  });
});
