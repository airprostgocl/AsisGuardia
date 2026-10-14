ALTER TABLE `supervisors` ADD `username` varchar(80) NOT NULL;--> statement-breakpoint
ALTER TABLE `supervisors` ADD `passwordHash` varchar(180) NOT NULL;--> statement-breakpoint
ALTER TABLE `supervisors` ADD CONSTRAINT `supervisors_username_unique` UNIQUE(`username`);