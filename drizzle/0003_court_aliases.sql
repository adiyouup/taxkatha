CREATE TABLE "court_aliases" (
	"key" text PRIMARY KEY NOT NULL,
	"court_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "courts" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "court_aliases" ADD CONSTRAINT "court_aliases_court_id_courts_id_fk" FOREIGN KEY ("court_id") REFERENCES "public"."courts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "court_aliases_court_idx" ON "court_aliases" USING btree ("court_id");