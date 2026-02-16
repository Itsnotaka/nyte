CREATE INDEX `audit_logs_target_lookup_idx` ON `audit_logs` (`target_type`,`target_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `audit_logs_created_at_idx` ON `audit_logs` (`created_at`);