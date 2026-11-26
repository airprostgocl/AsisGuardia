CREATE TABLE "extra_shifts" (
	"id" serial PRIMARY KEY NOT NULL,
	"guardId" integer NOT NULL,
	"shiftDate" date NOT NULL,
	"shift" varchar(8) NOT NULL,
	"startTime" varchar(5) NOT NULL,
	"hours" integer NOT NULL,
	"companyId" integer NOT NULL,
	"replacedGuardId" integer,
	"createdBy" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "guards" ADD COLUMN "baseShift" varchar(10);--> statement-breakpoint
CREATE UNIQUE INDEX "extra_shifts_guard_date_shift_unique" ON "extra_shifts" USING btree ("guardId","shiftDate","shift");