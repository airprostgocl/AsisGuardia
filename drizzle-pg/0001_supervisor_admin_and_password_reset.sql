CREATE TABLE "password_reset_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"supervisorId" integer NOT NULL,
	"tokenHash" varchar(128) NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"usedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "password_reset_tokens_tokenHash_unique" UNIQUE("tokenHash")
);
--> statement-breakpoint
ALTER TABLE "supervisors" ADD COLUMN "email" varchar(320);--> statement-breakpoint
ALTER TABLE "supervisors" ADD COLUMN "isAdmin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "supervisors" ADD COLUMN "mustChangePassword" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "supervisors" ADD CONSTRAINT "supervisors_email_unique" UNIQUE("email");--> statement-breakpoint
-- El primer supervisor (id más bajo) queda como administrador.
UPDATE "supervisors" SET "isAdmin" = true WHERE "id" = (SELECT min("id") FROM "supervisors");
