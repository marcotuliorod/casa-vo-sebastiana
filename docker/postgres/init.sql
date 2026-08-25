-- Extensões exigidas pelo schema (uuid/token gen e a constraint EXCLUDE USING GIST)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "btree_gist";
