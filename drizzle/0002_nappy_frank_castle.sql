ALTER TABLE `guards` ADD `annualVacation` decimal(6,2) DEFAULT '15' NOT NULL;--> statement-breakpoint
ALTER TABLE `guards` ADD `vacationUsedBefore` decimal(6,2) DEFAULT '0' NOT NULL;