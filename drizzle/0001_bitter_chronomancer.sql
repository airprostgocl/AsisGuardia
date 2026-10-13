CREATE TABLE `absence_types` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(8) NOT NULL,
	`name` varchar(80) NOT NULL,
	`deductionFactor` decimal(4,2) NOT NULL DEFAULT '0',
	`color` varchar(16) NOT NULL,
	CONSTRAINT `absence_types_id` PRIMARY KEY(`id`),
	CONSTRAINT `absence_types_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `attendance_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`guardId` int NOT NULL,
	`recordDate` date NOT NULL,
	`absenceTypeId` int,
	`notes` text,
	`registeredBy` int,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `attendance_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `guards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`rut` varchar(20) NOT NULL,
	`name` varchar(180) NOT NULL,
	`hireDate` date,
	`post` varchar(160) NOT NULL,
	`initialVacation` decimal(6,2) NOT NULL DEFAULT '0',
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `guards_id` PRIMARY KEY(`id`),
	CONSTRAINT `guards_rut_unique` UNIQUE(`rut`)
);
