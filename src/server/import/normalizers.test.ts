import { describe, expect, it } from "vitest";

import { normalizeCourt } from "./courts";
import { parseDecisionDate } from "./dates";
import { normalizeOutcome } from "./outcome";
import { parseSectionRefs } from "./sections";
import { cleanSummary } from "./summary";
import { cleanText, slugify } from "./text";
import { DEFAULT_ALIAS_INDEX, extractTopicLabel } from "./topics";

describe("cleanText", () => {
  it("strips publisher boilerplate wherever it appears", () => {
    expect(
      cleanText("to evade tax - Such © 2026 Taxmann Allied Services Private Limited. All rights reserved. factual issues"),
    ).toBe("to evade tax - Such factual issues");
  });

  it("collapses whitespace and removes control characters", () => {
    expect(cleanText("  a\u0007 \n\t b c ,d ")).toBe("a b c,d");
    expect(cleanText(null)).toBe("");
  });
});

describe("slugify", () => {
  it("makes stable ASCII slugs and cuts at a word boundary", () => {
    expect(slugify("Manoj Bansal v. Deputy Director, DGGI")).toBe("manoj-bansal-v-deputy-director-dggi");
    expect(slugify("M/s. A & B Traders (P.) Ltd.")).toBe("m-s-a-and-b-traders-p-ltd");
    expect(slugify("alpha beta gamma delta", 12)).toBe("alpha-beta");
  });
});

describe("normalizeCourt", () => {
  it("merges bench/spacing/typo variants of the same forum", () => {
    const variants = [
      "GOODS AND SERVICE TAX APPELLATE TRIBUNAL , NEW DELHI",
      "GOODS AND SERVICE TAX APPELLATE TRIBUNAL , NEW DELHI BENCH",
      "GOODS AND SERVICE TAX APPELLATE TRIBUNAL, NEW DELHI",
      "GOODS AND SERVICE TAX APPELLATE TRIBUNAL NEW DELHI, PRINCIPAL BENCH",
    ].map((v) => normalizeCourt(v)!);
    expect(new Set(variants.map((v) => v.key))).toEqual(new Set(["GSTAT NEW DELHI"]));
    expect(variants[0]).toMatchObject({ type: "gstat", shortName: "GSTAT New Delhi", name: "GST Appellate Tribunal, New Delhi" });

    expect(normalizeCourt("GOODS AND SERVICE TAX APPELLATE TRIBUNAL , HRDERABAD")!.key).toBe("GSTAT HYDERABAD");
    expect(normalizeCourt("GOODS AND SERVICE TAX APPELLATE TRIBUNAL , TRIVANDRUM BENCH")!.key).toBe(
      normalizeCourt("GOODS AND SERVICE TAX APPELLATE TRIBUNAL , THIRUVANANTHAPURAM")!.key,
    );
  });

  it("classifies courts and matches AAAR before AAR", () => {
    expect(normalizeCourt("SUPREME COURT OF INDIA")).toMatchObject({ type: "supreme_court", shortName: "Supreme Court" });
    expect(normalizeCourt("HIGH COURT OF PUNJAB & HARYANA")).toMatchObject({
      type: "high_court",
      name: "High Court of Punjab & Haryana",
      shortName: "Punjab & Haryana High Court",
      slug: "punjab-and-haryana-high-court",
    });
    expect(normalizeCourt("APPELLATE AUTHORITY FOR ADVANCE RULING , WEST BENGAL")).toMatchObject({ type: "aaar", shortName: "AAAR West Bengal" });
    expect(normalizeCourt("AUTHORITY FOR ADVANCE RULING , TAMILNADU")).toMatchObject({ type: "aar", shortName: "AAR Tamil Nadu" });
    expect(normalizeCourt("NATIONAL COMPANY LAW APPELLATE TRIBUNAL, NEW DELHI")).toMatchObject({ type: "tribunal", shortName: "NCLAT New Delhi" });
    expect(normalizeCourt("  ")).toBeNull();
  });

  it("keeps a raw key that ignores only spacing, punctuation and BENCH", () => {
    expect(normalizeCourt("GOODS AND SERVICE TAX APPELLATE TRIBUNAL , HRDERABAD")!.rawKey).toBe(
      "GOODS AND SERVICE TAX APPELLATE TRIBUNAL HRDERABAD",
    );
  });
});

describe("normalizeOutcome", () => {
  it.each([
    ["In favour of assessee", "assessee", false],
    ["in favour of assessee", "assessee", false],
    ["In favour of assessee/Matter remanded", "assessee", true],
    ["In favour of revenue", "revenue", false],
    ["In favour of revenue/matter remanded", "revenue", true],
    ["Against assessee", "revenue", false],
    ["Partly in favour of assessee", "partly", false],
    ["The disposition is summarised in the decision above.", "unknown", false],
    ["", "unknown", false],
  ])("%s → %s (remanded: %s)", (raw, side, remanded) => {
    expect(normalizeOutcome(raw)).toMatchObject({ side, remanded });
  });
});

describe("cleanSummary", () => {
  it.each([
    ["GST: Where assessee filed", "GST", "gst", "Where assessee filed"],
    ["Haryana)[01-08-2026] GST: Where complaint alleged", "GST", "gst", "Where complaint alleged"],
    ["THANE)/ GST/Excise: Where refund order", "GST/Excise", "gst", "Where refund order"],
    ["(SC)[06-08-2026] GST: Omission of Rule 96(10)", "GST", "gst", "Omission of Rule 96(10)"],
    ["06-2026] GST: Where DGGI issued SCN", "GST", "gst", "Where DGGI issued SCN"],
    ["GSTL 101 (Madras)[23-06-2026] GST: Where a firm’s dues", "GST", "gst", "Where a firm’s dues"],
    ["KVAT: Where gold jewelry trader", "KVAT", "vat", "Where gold jewelry trader"],
    ["GST(MISC): Where works were completed", "GST (MISC)", "gst", "Where works were completed"],
    ["CENTRAL EXCISE: Where CESTAT determined", "CENTRAL EXCISE", "excise", "Where CESTAT determined"],
    ["IBC/ GST: Where resolution plan", "IBC/GST", "ibc", "Where resolution plan"],
  ])("%s", (raw, label, domain, summary) => {
    expect(cleanSummary(raw)).toMatchObject({ domainLabel: label, domain, summary, labelled: true });
  });

  it("never mistakes an ordinary sentence with a colon for a label", () => {
    const result = cleanSummary("Where assessee argued one point: that notice was time-barred, it was held otherwise");
    expect(result.labelled).toBe(false);
    expect(result.summary).toMatch(/^Where assessee argued/);
  });

  it("falls back to the cited statute for the domain", () => {
    expect(cleanSummary("Where refund was denied", "Section 54 of Central Goods and Services Tax Act, 2017").domain).toBe("gst");
  });
});

describe("parseSectionRefs", () => {
  it("expands 'read with' lists and folds State GST Acts into CGST", () => {
    expect(
      parseSectionRefs(
        "Section 74, read with sections 44, 65, 73, 75 and 168A, of Central Goods and Services Tax Act, 2017/Tamil Nadu Goods and Services Tax Act, 2017",
      ),
    ).toEqual(["CGST S.74", "CGST S.44", "CGST S.65", "CGST S.73", "CGST S.75", "CGST S.168A"]);
  });

  it("separates Acts, Rules and the Constitution", () => {
    expect(
      parseSectionRefs(
        "Section 75 of Central Goods and Services Tax Act, 2017/Delhi Goods and Services Tax Act, 2017 - Rule 142 of Central Goods and Services Tax Rules, 2017/Delhi Goods and Services Tax Rules, 2017 - Article 226 of Constitution of India, 1950",
      ),
    ).toEqual(["CGST S.75", "CGST Rules R.142", "Constitution Art.226"]);
  });

  it("ignores sub-clauses and recognises IGST", () => {
    expect(parseSectionRefs("Section 16(2)(c) of Central Goods and Services Tax Act, 2017 - Section 16 of Integrated Goods and Services Tax Act, 2017")).toEqual([
      "CGST S.16",
      "IGST S.16",
    ]);
    expect(parseSectionRefs("Rule 96(10) of Central Goods and Services Tax Rules, 2017")).toEqual(["CGST Rules R.96"]);
    expect(parseSectionRefs("")).toEqual([]);
  });
});

describe("extractTopicLabel", () => {
  it("takes the subject before the first dash", () => {
    expect(extractTopicLabel("Demands - Limitation period - Whether notice was time-barred")?.label).toBe("Demands");
    expect(extractTopicLabel("\\ Registration - Cancellation of")?.label).toBe("Registration");
    expect(extractTopicLabel("Supply – Zero rated supply - Export of services")?.label).toBe("Supply");
  });

  it("rejects openings that are sentences or citations", () => {
    expect(extractTopicLabel("GST: Where petitioner’s statutory appeal delay was due to non-communication - held")).toBeNull();
    expect(extractTopicLabel("Section 53 of the Insolvency and Bankruptcy Code, 2016 - priority")).toBeNull();
    expect(extractTopicLabel("No separator here")).toBeNull();
  });

  it("maps noisy labels onto curated topics", () => {
    expect(DEFAULT_ALIAS_INDEX.get(extractTopicLabel("IInterest - Delayed payment")!.key)).toBe("interest-waiver");
    expect(DEFAULT_ALIAS_INDEX.get(extractTopicLabel("Demand - Show cause notice")!.key)).toBe("demands-adjudication");
    expect(DEFAULT_ALIAS_INDEX.get(extractTopicLabel("Service of notices/orders etc. - Portal upload")!.key)).toBe("service-of-notices-orders");
  });
});

describe("parseDecisionDate", () => {
  it("handles Date objects, ISO strings, serials and day-first text", () => {
    expect(parseDecisionDate(new Date("2026-08-01T00:00:00.000Z"))).toBe("2026-08-01");
    expect(parseDecisionDate("2026-08-01T00:00:00.000Z")).toBe("2026-08-01");
    expect(parseDecisionDate(46235)).toBe("2026-08-01");
    expect(parseDecisionDate("01-08-2026")).toBe("2026-08-01");
    expect(parseDecisionDate("1/8/2026")).toBe("2026-08-01");
    expect(parseDecisionDate("1 Aug 2026")).toBe("2026-08-01");
    expect(parseDecisionDate("August 1, 2026")).toBe("2026-08-01");
  });

  it("rejects impossible dates", () => {
    expect(parseDecisionDate("31-02-2026")).toBeNull();
    expect(parseDecisionDate("soon")).toBeNull();
    expect(parseDecisionDate("")).toBeNull();
  });
});
