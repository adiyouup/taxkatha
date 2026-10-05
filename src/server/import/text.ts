import { createHash } from "node:crypto";

/*
 * Pure text helpers for the import pipeline. No database, no Next.js — these
 * run identically in the app, in the seed CLI and in unit tests.
 */

/** Publisher boilerplate that leaks into exported cells, wherever it appears. */
const COPYRIGHT = /\s*©\s*\d{4}\s+[^.©]{0,80}?\.\s*All rights reserved\.?\s*/gi;

/** NFC, strip control characters and boilerplate, collapse whitespace. */
export function cleanText(input: unknown): string {
  if (input === null || input === undefined) return "";
  return String(input)
    .normalize("NFC")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‍﻿]/g, "")
    .replace(COPYRIGHT, " ")
    .replace(/[\t\r\n  ]+/g, " ")
    .replace(/\s+([,;.])/g, "$1")
    .trim();
}

export function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/** ASCII, lower-case, hyphen-separated. */
export function slugify(input: string, maxLength = 80): string {
  const slug = input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (slug.length <= maxLength) return slug;
  const cut = slug.slice(0, maxLength);
  const lastHyphen = cut.lastIndexOf("-");
  return (lastHyphen > maxLength * 0.6 ? cut.slice(0, lastHyphen) : cut).replace(/-+$/g, "");
}

/** Comparison key: case-, punctuation- and spacing-insensitive. */
export function matchKey(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const SMALL_WORDS = new Set(["of", "and", "the", "for", "in", "on", "to", "at", "by", "or"]);

/** "HIGH COURT OF PUNJAB & HARYANA" → "High Court of Punjab & Haryana". */
export function titleCase(input: string): string {
  return input
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word, i) => (i > 0 && SMALL_WORDS.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(" ");
}
