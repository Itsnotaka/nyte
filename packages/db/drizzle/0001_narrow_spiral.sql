CREATE TABLE "ingestion_state" (
	"user_id" text PRIMARY KEY NOT NULL,
	"gmail_cursor" text,
	"calendar_cursor" text,
	"last_synced_at" timestamp with time zone,
	"bootstrap_completed_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "calendar_events" DROP CONSTRAINT "calendar_events_action_id_proposed_actions_id_fk";
--> statement-breakpoint
ALTER TABLE "feedback_entries" DROP CONSTRAINT "feedback_entries_work_item_id_work_items_id_fk";
--> statement-breakpoint
ALTER TABLE "gmail_drafts" DROP CONSTRAINT "gmail_drafts_action_id_proposed_actions_id_fk";
--> statement-breakpoint
ALTER TABLE "proposed_actions" DROP CONSTRAINT "proposed_actions_work_item_id_work_items_id_fk";
--> statement-breakpoint
ALTER TABLE "workflow_events" DROP CONSTRAINT "workflow_events_run_id_workflow_runs_id_fk";
--> statement-breakpoint
ALTER TABLE "workflow_runs" DROP CONSTRAINT "workflow_runs_work_item_id_work_items_id_fk";
--> statement-breakpoint
ALTER TABLE "work_items" ADD COLUMN "importance_tier" text;--> statement-breakpoint
ALTER TABLE "work_items" ADD COLUMN "importance_score" integer;--> statement-breakpoint
ALTER TABLE "work_items" ADD COLUMN "importance_reason" text;--> statement-breakpoint
ALTER TABLE "work_items" ADD COLUMN "importance_version" text;--> statement-breakpoint
ALTER TABLE "work_items" ADD COLUMN "classified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ingestion_state" ADD CONSTRAINT "ingestion_state_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ingestion_state_updated_at_idx" ON "ingestion_state" USING btree ("updated_at");--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_action_id_proposed_actions_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."proposed_actions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_entries" ADD CONSTRAINT "feedback_entries_work_item_id_work_items_id_fk" FOREIGN KEY ("work_item_id") REFERENCES "public"."work_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gmail_drafts" ADD CONSTRAINT "gmail_drafts_action_id_proposed_actions_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."proposed_actions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposed_actions" ADD CONSTRAINT "proposed_actions_work_item_id_work_items_id_fk" FOREIGN KEY ("work_item_id") REFERENCES "public"."work_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_events" ADD CONSTRAINT "workflow_events_run_id_workflow_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."workflow_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_work_item_id_work_items_id_fk" FOREIGN KEY ("work_item_id") REFERENCES "public"."work_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_events_action_id_uidx" ON "calendar_events" USING btree ("action_id");--> statement-breakpoint
CREATE INDEX "connected_accounts_user_id_idx" ON "connected_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "gate_evaluations_work_item_id_idx" ON "gate_evaluations" USING btree ("work_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "gmail_drafts_action_id_uidx" ON "gmail_drafts" USING btree ("action_id");--> statement-breakpoint
CREATE INDEX "policy_rules_user_id_idx" ON "policy_rules" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "proposed_actions_work_item_id_uidx" ON "proposed_actions" USING btree ("work_item_id");--> statement-breakpoint
CREATE INDEX "work_items_user_id_idx" ON "work_items" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "work_items_user_status_priority_idx" ON "work_items" USING btree ("user_id","status","priority_score","updated_at");--> statement-breakpoint
CREATE INDEX "work_items_user_status_importance_idx" ON "work_items" USING btree ("user_id","status","importance_tier","importance_score","updated_at");--> statement-breakpoint
CREATE INDEX "workflow_events_run_id_idx" ON "workflow_events" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "workflow_runs_work_item_id_idx" ON "workflow_runs" USING btree ("work_item_id");--> statement-breakpoint
ALTER TABLE "feedback_entries" ADD CONSTRAINT "feedback_entries_rating_check" CHECK ("feedback_entries"."rating" IN ('positive', 'negative'));--> statement-breakpoint
ALTER TABLE "gate_evaluations" ADD CONSTRAINT "gate_evaluations_gate_check" CHECK ("gate_evaluations"."gate" IN ('decision', 'time', 'relationship', 'impact', 'watch'));--> statement-breakpoint
ALTER TABLE "gate_evaluations" ADD CONSTRAINT "gate_evaluations_score_check" CHECK ("gate_evaluations"."score" >= 0 AND "gate_evaluations"."score" <= 10);--> statement-breakpoint
ALTER TABLE "proposed_actions" ADD CONSTRAINT "proposed_actions_status_check" CHECK ("proposed_actions"."status" IN ('pending', 'executed', 'dismissed'));--> statement-breakpoint
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_status_check" CHECK ("work_items"."status" IN ('awaiting_approval', 'completed', 'dismissed'));--> statement-breakpoint
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_importance_tier_check" CHECK ("work_items"."importance_tier" IS NULL OR "work_items"."importance_tier" IN ('critical', 'important', 'later'));--> statement-breakpoint
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_importance_score_check" CHECK ("work_items"."importance_score" IS NULL OR ("work_items"."importance_score" >= 0 AND "work_items"."importance_score" <= 100));--> statement-breakpoint
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_phase_check" CHECK ("workflow_runs"."phase" IN ('ingest', 'approve', 'dismiss', 'feedback'));--> statement-breakpoint
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_status_check" CHECK ("workflow_runs"."status" IN ('completed'));