import { customType, timestamp } from "drizzle-orm/pg-core";

/** Postgres `tsvector` (full-text search document). */
export const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

export const createdAt = () => timestamp({ withTimezone: true }).notNull().defaultNow();
export const updatedAt = () =>
  timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());
