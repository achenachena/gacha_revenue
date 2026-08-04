CREATE TABLE `ios_rank_observations` (
	`subject_key` text NOT NULL,
	`market` text NOT NULL,
	`observed_at` text NOT NULL,
	`rank` integer,
	`source_url` text NOT NULL,
	`source_status` integer NOT NULL,
	`captured_at` text NOT NULL,
	PRIMARY KEY(`subject_key`, `market`, `observed_at`)
);
