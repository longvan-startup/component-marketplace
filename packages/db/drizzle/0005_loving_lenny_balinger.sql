DO $$
DECLARE
	unsupported_category_rows bigint;
	invalid_component_rows bigint;
BEGIN
	SELECT count(*)
	INTO unsupported_category_rows
	FROM "components"
	WHERE "category" IS NULL
		OR "category" NOT IN ('animation', 'react-component', 'tool');

	SELECT count(*)
	INTO invalid_component_rows
	FROM "components"
	WHERE "slug" !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
		OR char_length("slug") > 80
		OR char_length("name") NOT BETWEEN 1 AND 120
		OR ("description" IS NOT NULL AND char_length("description") > 5000)
		OR cardinality("tags") > 12
		OR coalesce(array_ndims("tags"), 0) > 1
		OR EXISTS (
			SELECT 1
			FROM unnest("tags") AS tag_values(tag)
			WHERE tag IS NULL OR tag = '' OR char_length(tag) > 40
		)
		OR "latest_version" !~ '^[0-9]+\.[0-9]+\.[0-9]+$';

	IF unsupported_category_rows > 0 OR invalid_component_rows > 0 THEN
		RAISE EXCEPTION
			'Catalog migration preflight failed: % rows have unsupported categories; % rows violate component field constraints. No records changed.',
			unsupported_category_rows,
			invalid_component_rows;
	END IF;
END $$;--> statement-breakpoint
CREATE TYPE "public"."catalog_category" AS ENUM('animation', 'react-component', 'tool');--> statement-breakpoint
ALTER TABLE "components" ALTER COLUMN "category" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "components" ALTER COLUMN "category" SET DATA TYPE "public"."catalog_category" USING "category"::"public"."catalog_category";--> statement-breakpoint
ALTER TABLE "components" ALTER COLUMN "tags" SET DATA TYPE varchar(40)[];--> statement-breakpoint
ALTER TABLE "components" ALTER COLUMN "tags" SET DEFAULT '{}';--> statement-breakpoint
ALTER TABLE "components" ADD COLUMN "price_amount_minor" integer;--> statement-breakpoint
ALTER TABLE "components" ADD COLUMN "price_currency" varchar(3);--> statement-breakpoint
ALTER TABLE "components" ADD COLUMN "requires_payment_for_update" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "components_tags_gin_idx" ON "components" USING gin ("tags");--> statement-breakpoint
ALTER TABLE "components" ADD CONSTRAINT "components_slug_format_check" CHECK ("components"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length("components"."slug") <= 80);--> statement-breakpoint
ALTER TABLE "components" ADD CONSTRAINT "components_name_length_check" CHECK (char_length("components"."name") BETWEEN 1 AND 120);--> statement-breakpoint
ALTER TABLE "components" ADD CONSTRAINT "components_description_length_check" CHECK ("components"."description" IS NULL OR char_length("components"."description") <= 5000);--> statement-breakpoint
ALTER TABLE "components" ADD CONSTRAINT "components_tags_count_check" CHECK (cardinality("components"."tags") <= 12 AND coalesce(array_ndims("components"."tags"), 0) <= 1 AND array_position("components"."tags", '') IS NULL AND array_position("components"."tags", NULL) IS NULL);--> statement-breakpoint
ALTER TABLE "components" ADD CONSTRAINT "components_latest_version_check" CHECK ("components"."latest_version" ~ '^[0-9]+\.[0-9]+\.[0-9]+$');--> statement-breakpoint
ALTER TABLE "components" ADD CONSTRAINT "components_price_amount_check" CHECK ("components"."price_amount_minor" IS NULL OR "components"."price_amount_minor" > 0);--> statement-breakpoint
ALTER TABLE "components" ADD CONSTRAINT "components_price_currency_check" CHECK ("components"."price_currency" IS NULL OR "components"."price_currency" ~ '^[A-Z]{3}$');--> statement-breakpoint
ALTER TABLE "components" ADD CONSTRAINT "components_price_pair_check" CHECK (("components"."price_amount_minor" IS NULL) = ("components"."price_currency" IS NULL));--> statement-breakpoint
ALTER TABLE "components" ADD CONSTRAINT "components_paid_update_price_check" CHECK (NOT "components"."requires_payment_for_update" OR "components"."price_amount_minor" IS NOT NULL);
