-- Vali Health Prototype: Shift Backfilling schema

-- Extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Core: clients
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  first_name TEXT NOT NULL,
  last_initial TEXT NOT NULL CHECK (char_length(last_initial) = 1),
  phone_number TEXT,
  primary_language TEXT NOT NULL DEFAULT 'en',
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  location GEOGRAPHY(POINT, 4326),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Core: caregivers
CREATE TABLE IF NOT EXISTS caregivers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name TEXT NOT NULL,
  phone_number TEXT UNIQUE NOT NULL,
  skills TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  primary_language TEXT NOT NULL DEFAULT 'en',
  location GEOGRAPHY(POINT, 4326),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'on_leave', 'blacklisted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Core: shifts
CREATE TABLE IF NOT EXISTS shifts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  caregiver_id UUID REFERENCES caregivers(id) ON DELETE SET NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  required_skills TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  status TEXT NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'cancelled', 'open', 'filled')),
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_time > start_time)
);

-- Stats used for ranking
CREATE TABLE IF NOT EXISTS caregiver_stats (
  caregiver_id UUID PRIMARY KEY REFERENCES caregivers(id) ON DELETE CASCADE,
  reliability_score NUMERIC NOT NULL DEFAULT 0.5 CHECK (reliability_score >= 0 AND reliability_score <= 1),
  last_minute_accept_rate NUMERIC NOT NULL DEFAULT 0.5 CHECK (last_minute_accept_rate >= 0 AND last_minute_accept_rate <= 1),
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Operational: backfill run state (durable)
CREATE TABLE IF NOT EXISTS backfill_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'filled', 'escalated', 'expired', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deadline_at TIMESTAMPTZ NOT NULL,
  chosen_caregiver_id UUID REFERENCES caregivers(id),
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB
);

-- Operational: every outreach attempt
CREATE TABLE IF NOT EXISTS backfill_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id UUID NOT NULL REFERENCES backfill_runs(id) ON DELETE CASCADE,
  caregiver_id UUID NOT NULL REFERENCES caregivers(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('sms', 'voice')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'sent', 'delivered', 'accepted', 'declined', 'no_answer', 'failed')
  ),
  provider_message_id TEXT,
  provider_call_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  raw_response JSONB
);

-- Compliance: append-only audit log of AI decisions and sensitive flows
CREATE TABLE IF NOT EXISTS system_audit (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor TEXT NOT NULL DEFAULT 'system',
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  input_redacted JSONB,
  output JSONB,
  rationale TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB
);

-- Indexes
CREATE INDEX IF NOT EXISTS caregivers_location_gix ON caregivers USING GIST (location);
CREATE INDEX IF NOT EXISTS clients_location_gix ON clients USING GIST (location);
CREATE INDEX IF NOT EXISTS caregivers_status_idx ON caregivers (status);

CREATE INDEX IF NOT EXISTS shifts_status_idx ON shifts (status);
CREATE INDEX IF NOT EXISTS shifts_time_idx ON shifts (start_time, end_time);
CREATE INDEX IF NOT EXISTS shifts_client_idx ON shifts (client_id);
CREATE INDEX IF NOT EXISTS shifts_caregiver_idx ON shifts (caregiver_id);

CREATE INDEX IF NOT EXISTS backfill_runs_shift_idx ON backfill_runs (shift_id);
CREATE INDEX IF NOT EXISTS backfill_runs_status_idx ON backfill_runs (status);
CREATE INDEX IF NOT EXISTS backfill_attempts_run_idx ON backfill_attempts (run_id);
CREATE INDEX IF NOT EXISTS backfill_attempts_status_idx ON backfill_attempts (status);
CREATE UNIQUE INDEX IF NOT EXISTS backfill_attempts_unique_per_channel
  ON backfill_attempts (run_id, caregiver_id, channel);

CREATE INDEX IF NOT EXISTS system_audit_action_idx ON system_audit (action);
CREATE INDEX IF NOT EXISTS system_audit_entity_idx ON system_audit (entity_type, entity_id);

