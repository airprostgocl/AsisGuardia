CREATE TABLE `supervisorSites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`supervisorId` int NOT NULL,
	`siteId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `supervisorSites_id` PRIMARY KEY(`id`)
);
