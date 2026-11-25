CREATE TABLE "attendance_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"guardId" integer NOT NULL,
	"recordDate" date NOT NULL,
	"previousTypeId" integer,
	"previousMarked" boolean DEFAULT false NOT NULL,
	"newTypeId" integer,
	"changedBy" integer,
	"changedAt" timestamp DEFAULT now() NOT NULL
);
