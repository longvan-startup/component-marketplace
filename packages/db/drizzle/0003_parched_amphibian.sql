DO $$
BEGIN
  LOCK TABLE "accounts" IN SHARE MODE;

  IF EXISTS (
    SELECT 1
    FROM "accounts"
    GROUP BY "provider_id", "account_id"
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot create accounts_provider_account_unique: duplicate provider/account keys exist. Resolve collisions and retry.';
  END IF;

  EXECUTE 'CREATE UNIQUE INDEX "accounts_provider_account_unique" ON "accounts" USING btree ("provider_id", "account_id")';
END $$;
