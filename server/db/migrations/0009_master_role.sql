-- The setup account (the oldest super user) becomes the one master.
UPDATE "user" SET "role" = 'master'
WHERE "id" = (SELECT "id" FROM "user" WHERE "role" = 'super_user' ORDER BY "created_at" LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM "user" WHERE "role" = 'master');
