CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TABLE "absence_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(8) NOT NULL,
	"name" varchar(80) NOT NULL,
	"deductionFactor" numeric(4, 2) DEFAULT '0' NOT NULL,
	"color" varchar(16) NOT NULL,
	CONSTRAINT "absence_types_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "attendance_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"guardId" integer NOT NULL,
	"recordDate" date NOT NULL,
	"absenceTypeId" integer,
	"notes" text,
	"registeredBy" integer,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(180) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"isDemo" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "companies_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "guards" (
	"id" serial PRIMARY KEY NOT NULL,
	"rut" varchar(20) NOT NULL,
	"name" varchar(180) NOT NULL,
	"hireDate" date,
	"post" varchar(160) NOT NULL,
	"companyId" integer,
	"siteId" integer,
	"supervisorId" integer,
	"initialVacation" numeric(6, 2) DEFAULT '0' NOT NULL,
	"annualVacation" numeric(6, 2) DEFAULT '15' NOT NULL,
	"vacationUsedBefore" numeric(6, 2) DEFAULT '0' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"isDemo" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "guards_rut_unique" UNIQUE("rut")
);
--> statement-breakpoint
CREATE TABLE "sites" (
	"id" serial PRIMARY KEY NOT NULL,
	"companyId" integer,
	"companyName" varchar(180) NOT NULL,
	"siteName" varchar(180),
	"supervisorId" integer,
	"active" boolean DEFAULT true NOT NULL,
	"isDemo" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supervisorSites" (
	"id" serial PRIMARY KEY NOT NULL,
	"supervisorId" integer NOT NULL,
	"siteId" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supervisors" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(180) NOT NULL,
	"username" varchar(80) NOT NULL,
	"passwordHash" varchar(180) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "supervisors_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"openId" varchar(64) NOT NULL,
	"name" text,
	"email" varchar(320),
	"loginMethod" varchar(64),
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_openId_unique" UNIQUE("openId")
);
