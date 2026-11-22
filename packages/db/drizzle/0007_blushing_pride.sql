CREATE TABLE "component_release_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"release_id" uuid NOT NULL,
	"path" varchar(240) NOT NULL,
	"checksum_sha256" varchar(64) NOT NULL,
	CONSTRAINT "component_release_files_path_format_check" CHECK ("component_release_files"."path" ~ '^[^/].*$' AND "component_release_files"."path" !~ '(^|/)\.{1,2}(/|$)' AND "component_release_files"."path" !~ '(^|/)\.' AND "component_release_files"."path" !~ '//|/$' AND position(chr(92) in "component_release_files"."path") = 0 AND "component_release_files"."path" !~ '[[:cntrl:]<>:"|?*]'),
	CONSTRAINT "component_release_files_checksum_sha256_check" CHECK ("component_release_files"."checksum_sha256" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "component_releases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"component_id" uuid NOT NULL,
	"version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "component_releases_version_format_check" CHECK ("component_releases"."version" ~ '^[0-9]+\.[0-9]+\.[0-9]+$')
);
--> statement-breakpoint
ALTER TABLE "component_release_files" ADD CONSTRAINT "component_release_files_release_id_component_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."component_releases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "component_releases" ADD CONSTRAINT "component_releases_component_id_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."components"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "component_release_files_release_path_unique" ON "component_release_files" USING btree ("release_id","path");--> statement-breakpoint
CREATE UNIQUE INDEX "component_releases_component_version_unique" ON "component_releases" USING btree ("component_id","version");