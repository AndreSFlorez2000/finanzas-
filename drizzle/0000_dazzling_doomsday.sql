CREATE TABLE `ledger_history` (
	`owner_id` text NOT NULL,
	`revision` integer NOT NULL,
	`payload` text NOT NULL,
	`saved_at` text NOT NULL,
	PRIMARY KEY(`owner_id`, `revision`)
);
--> statement-breakpoint
CREATE TABLE `ledgers` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`payload` text NOT NULL,
	`updated_at` text NOT NULL
);
