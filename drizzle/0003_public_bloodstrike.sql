CREATE TABLE `sites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyName` varchar(180) NOT NULL,
	`siteName` varchar(180) NOT NULL,
	`supervisorId` int,
	`active` boolean NOT NULL DEFAULT true,
	`isDemo` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sites_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `supervisors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(180) NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `supervisors_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `guards` ADD `siteId` int;--> statement-breakpoint
ALTER TABLE `guards` ADD `supervisorId` int;--> statement-breakpoint
ALTER TABLE `guards` ADD `isDemo` boolean DEFAULT false NOT NULL;