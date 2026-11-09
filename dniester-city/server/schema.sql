CREATE TABLE IF NOT EXISTS organizations (
 id text PRIMARY KEY,
 name text NOT NULL,
 categories jsonb NOT NULL DEFAULT '[]',
 addresses jsonb NOT NULL DEFAULT '[]',
 connected boolean NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS users (
 id text PRIMARY KEY,
 telegram_id bigint UNIQUE NOT NULL,
 name text NOT NULL,
 role text NOT NULL DEFAULT 'resident' CHECK(role IN ('resident','dispatcher','admin')),
 organization_id text REFERENCES organizations(id),
 prefs jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS records (
 id text PRIMARY KEY,
 kind text NOT NULL CHECK(kind IN ('event','ticket','reading','schedule','meter','report')),
 owner_id text REFERENCES users(id),
 organization_id text REFERENCES organizations(id),
 data jsonb NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS records_owner_kind ON records(owner_id,kind);
CREATE INDEX IF NOT EXISTS records_org_kind ON records(organization_id,kind);
ALTER TABLE records DROP CONSTRAINT IF EXISTS records_kind_check;
ALTER TABLE records ADD CONSTRAINT records_kind_check CHECK(kind IN ('event','ticket','reading','schedule','meter','report'));
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS source_url text NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS records_data_gin ON records USING gin(data);
CREATE UNIQUE INDEX IF NOT EXISTS reading_period_unique ON records(owner_id,(data->>'address'),(data->>'category'),(COALESCE(data->>'meterId','legacy')),(data->>'period')) WHERE kind='reading';
CREATE TABLE IF NOT EXISTS mutation_receipts (
 user_id text NOT NULL REFERENCES users(id),
 request_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,request_id)
);
-- Upgrade v0.1 single-service readings without losing a user's existing history.
INSERT INTO records(id,kind,owner_id,organization_id,data)
SELECT 'legacy:'||md5(owner_id||':'||(data->>'address')||':'||(data->>'category')),
 'meter',owner_id,organization_id,
 jsonb_build_object('id','legacy:'||md5(owner_id||':'||(data->>'address')||':'||(data->>'category')),
 'address',data->>'address','category',data->>'category','name','Счётчик из истории',
 'serial','Номер не указан','account','','initialValue',min((data->>'previous')::numeric),'created',min(data->>'created'))
FROM records WHERE kind='reading' AND owner_id IS NOT NULL AND NOT(data ? 'meterId')
GROUP BY owner_id,organization_id,data->>'address',data->>'category'
ON CONFLICT(id) DO NOTHING;
UPDATE records SET data=jsonb_set(data,'{meterId}',to_jsonb('legacy:'||md5(owner_id||':'||(data->>'address')||':'||(data->>'category'))))
WHERE kind='reading' AND owner_id IS NOT NULL AND NOT(data ? 'meterId');
CREATE TABLE IF NOT EXISTS audit_log (
 id bigserial PRIMARY KEY,
 actor_id text REFERENCES users(id),
 action text NOT NULL,
 record_id text,
 details jsonb NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS notification_outbox (
 id bigserial PRIMARY KEY,
 user_id text NOT NULL REFERENCES users(id),
 dedupe_key text UNIQUE NOT NULL,
 text text NOT NULL,
 status text NOT NULL DEFAULT 'pending',
 attempts integer NOT NULL DEFAULT 0,
 next_attempt_at timestamptz NOT NULL DEFAULT now(),
 read boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE notification_outbox ADD COLUMN IF NOT EXISTS lease_token uuid;
CREATE INDEX IF NOT EXISTS outbox_due ON notification_outbox(status,next_attempt_at);
CREATE TABLE IF NOT EXISTS bot_state (key text PRIMARY KEY,value text NOT NULL);
