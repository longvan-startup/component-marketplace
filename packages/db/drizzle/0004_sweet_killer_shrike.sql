LOCK TABLE "users" IN SHARE ROW EXCLUSIVE MODE;--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "users"
    GROUP BY lower("email")
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot normalize user emails: case-insensitive collisions exist. Resolve them and retry.';
  END IF;
END
$$;--> statement-breakpoint
UPDATE "users"
SET "email" = lower("email"), "updated_at" = now()
WHERE ("email" COLLATE "C") IS DISTINCT FROM (lower("email") COLLATE "C");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_unique" ON "users" USING btree (lower("email"));--> statement-breakpoint
DROP INDEX "users_email_unique";--> statement-breakpoint
CREATE FUNCTION "users_integrity_before_write_fn"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW."email" := lower(NEW."email");
  IF TG_OP = 'UPDATE' THEN
    NEW."updated_at" := now();
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "users_integrity_before_write"
BEFORE INSERT OR UPDATE ON "users"
FOR EACH ROW
EXECUTE FUNCTION "users_integrity_before_write_fn"();
