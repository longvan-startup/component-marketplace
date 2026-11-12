DO $$
DECLARE
	priced_without_payment_flag bigint;
BEGIN
	SELECT count(*)
	INTO priced_without_payment_flag
	FROM "components"
	WHERE "price_amount_minor" IS NOT NULL
		AND "requires_payment_for_update" = false;

	IF priced_without_payment_flag > 0 THEN
		RAISE EXCEPTION
			'access_tier backfill preflight failed: % rows have a price but requires_payment_for_update = false. No records changed.',
			priced_without_payment_flag;
	END IF;
END $$;--> statement-breakpoint
CREATE TYPE "public"."component_access_tier" AS ENUM('free', 'pro');--> statement-breakpoint
ALTER TABLE "components" ADD COLUMN "access_tier" "component_access_tier" DEFAULT 'free' NOT NULL;--> statement-breakpoint
UPDATE "components"
SET "access_tier" = 'pro'
WHERE "requires_payment_for_update" = true;
