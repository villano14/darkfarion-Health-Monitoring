-- CrewHealth schema: catalog (what can be measured and how to read it), people, missions and health data.

-- ---------------------------------------------------------------------------
-- Catalog. Every user-facing text lives in a *_i18n table keyed by language.
-- ---------------------------------------------------------------------------
CREATE TABLE languages (
  code text PRIMARY KEY
);
INSERT INTO languages (code) VALUES ('en'), ('es');

CREATE TABLE environments (
  id         text PRIMARY KEY,
  gravity    text NOT NULL,
  delay      text NOT NULL,           -- one-way signal delay to Earth
  unloading  double precision NOT NULL, -- bone and muscle loss multiplier versus microgravity
  dose       double precision NOT NULL, -- typical daily radiation dose, mSv
  autonomous boolean NOT NULL,
  sort       int NOT NULL
);
CREATE TABLE environment_i18n (
  environment_id text REFERENCES environments(id) ON DELETE CASCADE,
  lang           text REFERENCES languages(code),
  name           text NOT NULL,
  PRIMARY KEY (environment_id, lang)
);

CREATE TABLE hazards (
  id   text PRIMARY KEY,
  sort int NOT NULL
);
CREATE TABLE hazard_i18n (
  hazard_id text REFERENCES hazards(id) ON DELETE CASCADE,
  lang      text REFERENCES languages(code),
  name      text NOT NULL,
  PRIMARY KEY (hazard_id, lang)
);

CREATE TABLE body_groups (
  id       text PRIMARY KEY,
  systems  text[] NOT NULL,          -- anatomical systems of the 3D model
  context  text[] NOT NULL DEFAULT '{}',
  hazards  text[] NOT NULL,          -- hazards.id
  sort     int NOT NULL
);
CREATE TABLE body_group_i18n (
  group_id text REFERENCES body_groups(id) ON DELETE CASCADE,
  lang     text REFERENCES languages(code),
  name     text NOT NULL,
  role     text NOT NULL,
  PRIMARY KEY (group_id, lang)
);

CREATE TABLE indicators (
  id          text PRIMARY KEY,
  group_id    text NOT NULL REFERENCES body_groups(id),
  unit        text NOT NULL,
  input       text NOT NULL CHECK (input IN ('bp', 'number', 'scale', 'scan')),
  min_value   double precision NOT NULL,
  max_value   double precision NOT NULL,
  step        double precision NOT NULL,
  range_text  text NOT NULL,
  normal_low  double precision NOT NULL,
  normal_high double precision NOT NULL,
  -- One band per value of the reading (blood pressure has two):
  -- [{"alertLow":..,"watchLow":..,"watchHigh":..,"alertHigh":..}]
  bands       jsonb NOT NULL,
  sort        int NOT NULL
);
CREATE TABLE indicator_i18n (
  indicator_id text REFERENCES indicators(id) ON DELETE CASCADE,
  lang         text REFERENCES languages(code),
  label        text NOT NULL,
  unit         text,             -- overrides indicators.unit when the language needs it
  how          text NOT NULL,
  device       text NOT NULL,
  why          text NOT NULL,
  space        text NOT NULL,
  source       text NOT NULL,
  steps        jsonb NOT NULL,   -- ["..."]
  actions      jsonb NOT NULL,   -- {"normal": [...], "watch-high": [...], ...}
  risks        jsonb NOT NULL,   -- {"watch-high": "...", ...}
  PRIMARY KEY (indicator_id, lang)
);

CREATE TABLE tiers (
  id   text PRIMARY KEY CHECK (id IN ('self', 'crew', 'surgeon')),
  sort int NOT NULL
);
CREATE TABLE tier_i18n (
  tier_id text REFERENCES tiers(id) ON DELETE CASCADE,
  lang    text REFERENCES languages(code),
  label   text NOT NULL,
  rule    text NOT NULL,
  PRIMARY KEY (tier_id, lang)
);

CREATE TABLE routine_tasks (
  id         text PRIMARY KEY,
  time_of_day text NOT NULL,                 -- HH:MM, mission time
  kind       text NOT NULL CHECK (kind IN ('measure', 'exercise')),
  indicators text[] NOT NULL DEFAULT '{}',
  points     int NOT NULL,
  sort       int NOT NULL
);
CREATE TABLE routine_task_i18n (
  task_id text REFERENCES routine_tasks(id) ON DELETE CASCADE,
  lang    text REFERENCES languages(code),
  label   text NOT NULL,
  PRIMARY KEY (task_id, lang)
);

CREATE TABLE achievements (
  id        text PRIMARY KEY,
  icon      text NOT NULL,
  points    int NOT NULL,
  sort      int NOT NULL
);
CREATE TABLE achievement_i18n (
  achievement_id text REFERENCES achievements(id) ON DELETE CASCADE,
  lang           text REFERENCES languages(code),
  name           text NOT NULL,
  description    text NOT NULL,
  PRIMARY KEY (achievement_id, lang)
);

-- ---------------------------------------------------------------------------
-- People and missions
-- ---------------------------------------------------------------------------
CREATE TABLE users (
  id            bigserial PRIMARY KEY,
  email         text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  name          text NOT NULL,
  initials      text NOT NULL,
  role          text NOT NULL CHECK (role IN ('astronaut', 'crew_medical_officer', 'flight_surgeon', 'admin')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE missions (
  id             bigserial PRIMARY KEY,
  name           text NOT NULL,
  environment_id text NOT NULL REFERENCES environments(id),
  start_date     date NOT NULL,        -- mission day 1
  planned_days   int NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE mission_members (
  mission_id bigint REFERENCES missions(id) ON DELETE CASCADE,
  user_id    bigint REFERENCES users(id) ON DELETE CASCADE,
  title      text NOT NULL DEFAULT '',  -- crew position, e.g. "Flight engineer"
  PRIMARY KEY (mission_id, user_id)
);
CREATE INDEX mission_members_user ON mission_members(user_id);

-- ---------------------------------------------------------------------------
-- Health data
-- ---------------------------------------------------------------------------
CREATE TABLE readings (
  id           bigserial PRIMARY KEY,
  user_id      bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mission_id   bigint NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  day          int NOT NULL CHECK (day >= 1),
  indicator_id text NOT NULL REFERENCES indicators(id),
  value        double precision[] NOT NULL,
  -- manual: typed in; camera: camera photoplethysmography; scan: onboard device;
  -- feed: live data feed; osdr: NASA open data; seed: demo history
  source       text NOT NULL CHECK (source IN ('manual', 'camera', 'scan', 'feed', 'osdr', 'seed')),
  recorded_by  bigint REFERENCES users(id),
  recorded_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, mission_id, day, indicator_id)
);
CREATE INDEX readings_lookup ON readings(user_id, mission_id, indicator_id, day DESC);

CREATE TABLE task_completions (
  user_id    bigint REFERENCES users(id) ON DELETE CASCADE,
  mission_id bigint REFERENCES missions(id) ON DELETE CASCADE,
  day        int NOT NULL,
  task_id    text REFERENCES routine_tasks(id),
  done_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, mission_id, day, task_id)
);

-- Raised by the server when a reading needs the crew or the flight surgeon.
CREATE TABLE alerts (
  id           bigserial PRIMARY KEY,
  user_id      bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mission_id   bigint NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  indicator_id text NOT NULL REFERENCES indicators(id),
  day          int NOT NULL,
  status       text NOT NULL CHECK (status IN ('watch', 'alert')),
  direction    text,
  tier         text NOT NULL REFERENCES tiers(id),
  value        double precision[] NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  acked_by     bigint REFERENCES users(id),
  acked_at     timestamptz,
  UNIQUE (user_id, mission_id, indicator_id, day)
);
CREATE INDEX alerts_open ON alerts(mission_id, acked_at);

CREATE TABLE alert_notes (
  id         bigserial PRIMARY KEY,
  alert_id   bigint NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
  author_id  bigint NOT NULL REFERENCES users(id),
  body       text NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- NASA data
-- ---------------------------------------------------------------------------
CREATE TABLE external_cache (
  key        text PRIMARY KEY,
  payload    jsonb NOT NULL,
  fetched_at timestamptz NOT NULL
);

CREATE TABLE osdr_datasets (
  id         text PRIMARY KEY,       -- e.g. OSD-575
  source     text NOT NULL,
  url        text NOT NULL,
  mission    text NOT NULL,
  lab_ranges jsonb NOT NULL
);
CREATE TABLE osdr_cmp_samples (
  dataset_id text REFERENCES osdr_datasets(id) ON DELETE CASCADE,
  crew       text NOT NULL,          -- anonymized crew id (C001...)
  timepoint  text NOT NULL,          -- L-92 ... R+194
  sort       int NOT NULL,
  glucose    double precision,
  calcium    double precision,
  creatinine double precision,
  PRIMARY KEY (dataset_id, crew, timepoint)
);
