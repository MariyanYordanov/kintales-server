CREATE TABLE "audio_recordings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"relative_id" uuid NOT NULL,
	"title" text,
	"file_url" text NOT NULL,
	"duration_seconds" integer,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "commemorations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"relative_id" uuid NOT NULL,
	"type" text NOT NULL,
	"comm_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"story_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "death_confirmations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"death_record_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"confirmed" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "death_conf_record_user_idx" UNIQUE("death_record_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "death_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"relative_id" uuid NOT NULL,
	"reported_by" uuid NOT NULL,
	"death_year" integer NOT NULL,
	"death_month" integer,
	"death_day" integer,
	"death_time" time,
	"cause_of_death" text,
	"status" text DEFAULT 'PENDING',
	"confirmations_needed" integer DEFAULT 2,
	"auto_confirm_at" timestamp with time zone,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "family_trees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"owner_id" uuid NOT NULL,
	"status" text DEFAULT 'ACTIVE',
	"archived_at" timestamp with time zone,
	"archive_reason" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "legacy_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tree_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"key_code" text NOT NULL,
	"key_type" text NOT NULL,
	"recipient_email" text,
	"recipient_name" text,
	"status" text DEFAULT 'ACTIVE',
	"used_by" uuid,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "legacy_keys_key_code_unique" UNIQUE("key_code")
);
--> statement-breakpoint
CREATE TABLE "name_days" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"name_variants" text[],
	"date_month" integer NOT NULL,
	"date_day" integer NOT NULL,
	"holiday_name" text,
	"tradition" text DEFAULT 'bulgarian',
	CONSTRAINT "name_days_unique_idx" UNIQUE("name","date_month","date_day","tradition")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"tree_id" uuid,
	"type" text NOT NULL,
	"relative_id" uuid,
	"title" text NOT NULL,
	"body" text,
	"event_date" date NOT NULL,
	"is_read" boolean DEFAULT false,
	"push_sent" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"relative_id" uuid NOT NULL,
	"file_url" text NOT NULL,
	"caption" text,
	"date_taken_year" integer,
	"date_taken_month" integer,
	"date_taken_day" integer,
	"sort_order" integer DEFAULT 0,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text,
	"full_name" text NOT NULL,
	"avatar_url" text,
	"bio" text,
	"language" text DEFAULT 'bg',
	"created_at" timestamp with time zone DEFAULT now(),
	"last_login_at" timestamp with time zone,
	CONSTRAINT "profiles_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "push_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"device_token" text NOT NULL,
	"platform" text NOT NULL,
	"device_info" text,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "push_tokens_user_device_idx" UNIQUE("user_id","device_token")
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"device_info" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "relationships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tree_id" uuid NOT NULL,
	"person_a_id" uuid NOT NULL,
	"person_b_id" uuid NOT NULL,
	"relationship_type" text NOT NULL,
	"marriage_year" integer,
	"marriage_month" integer,
	"marriage_day" integer,
	"divorce_year" integer,
	"divorce_month" integer,
	"divorce_day" integer,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "relatives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tree_id" uuid NOT NULL,
	"full_name" text NOT NULL,
	"birth_year" integer,
	"birth_month" integer,
	"birth_day" integer,
	"death_year" integer,
	"death_month" integer,
	"death_day" integer,
	"cause_of_death" text,
	"avatar_url" text,
	"bio" text,
	"status" text DEFAULT 'ALIVE',
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "stories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tree_id" uuid NOT NULL,
	"relative_id" uuid,
	"author_id" uuid NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "story_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"story_id" uuid NOT NULL,
	"file_url" text NOT NULL,
	"file_type" text NOT NULL,
	"caption" text,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tree_guardians" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tree_id" uuid NOT NULL,
	"guardian_user_id" uuid,
	"guardian_email" text,
	"guardian_name" text,
	"assigned_by" uuid NOT NULL,
	"status" text DEFAULT 'PENDING',
	"permissions" text DEFAULT 'FULL',
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tree_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tree_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'editor',
	"joined_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "tree_members_tree_user_idx" UNIQUE("tree_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "audio_recordings" ADD CONSTRAINT "audio_recordings_relative_id_relatives_id_fk" FOREIGN KEY ("relative_id") REFERENCES "public"."relatives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audio_recordings" ADD CONSTRAINT "audio_recordings_uploaded_by_profiles_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commemorations" ADD CONSTRAINT "commemorations_relative_id_relatives_id_fk" FOREIGN KEY ("relative_id") REFERENCES "public"."relatives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_profiles_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "death_confirmations" ADD CONSTRAINT "death_confirmations_death_record_id_death_records_id_fk" FOREIGN KEY ("death_record_id") REFERENCES "public"."death_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "death_confirmations" ADD CONSTRAINT "death_confirmations_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "death_records" ADD CONSTRAINT "death_records_relative_id_relatives_id_fk" FOREIGN KEY ("relative_id") REFERENCES "public"."relatives"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "death_records" ADD CONSTRAINT "death_records_reported_by_profiles_id_fk" FOREIGN KEY ("reported_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_trees" ADD CONSTRAINT "family_trees_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_keys" ADD CONSTRAINT "legacy_keys_tree_id_family_trees_id_fk" FOREIGN KEY ("tree_id") REFERENCES "public"."family_trees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_keys" ADD CONSTRAINT "legacy_keys_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_keys" ADD CONSTRAINT "legacy_keys_used_by_profiles_id_fk" FOREIGN KEY ("used_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tree_id_family_trees_id_fk" FOREIGN KEY ("tree_id") REFERENCES "public"."family_trees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_relative_id_relatives_id_fk" FOREIGN KEY ("relative_id") REFERENCES "public"."relatives"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_relative_id_relatives_id_fk" FOREIGN KEY ("relative_id") REFERENCES "public"."relatives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_uploaded_by_profiles_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_tree_id_family_trees_id_fk" FOREIGN KEY ("tree_id") REFERENCES "public"."family_trees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_person_a_id_relatives_id_fk" FOREIGN KEY ("person_a_id") REFERENCES "public"."relatives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_person_b_id_relatives_id_fk" FOREIGN KEY ("person_b_id") REFERENCES "public"."relatives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relatives" ADD CONSTRAINT "relatives_tree_id_family_trees_id_fk" FOREIGN KEY ("tree_id") REFERENCES "public"."family_trees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relatives" ADD CONSTRAINT "relatives_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stories" ADD CONSTRAINT "stories_tree_id_family_trees_id_fk" FOREIGN KEY ("tree_id") REFERENCES "public"."family_trees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stories" ADD CONSTRAINT "stories_relative_id_relatives_id_fk" FOREIGN KEY ("relative_id") REFERENCES "public"."relatives"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stories" ADD CONSTRAINT "stories_author_id_profiles_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_attachments" ADD CONSTRAINT "story_attachments_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tree_guardians" ADD CONSTRAINT "tree_guardians_tree_id_family_trees_id_fk" FOREIGN KEY ("tree_id") REFERENCES "public"."family_trees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tree_guardians" ADD CONSTRAINT "tree_guardians_guardian_user_id_profiles_id_fk" FOREIGN KEY ("guardian_user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tree_guardians" ADD CONSTRAINT "tree_guardians_assigned_by_profiles_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tree_members" ADD CONSTRAINT "tree_members_tree_id_family_trees_id_fk" FOREIGN KEY ("tree_id") REFERENCES "public"."family_trees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tree_members" ADD CONSTRAINT "tree_members_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;