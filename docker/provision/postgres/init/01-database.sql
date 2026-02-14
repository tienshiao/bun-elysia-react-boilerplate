-- CREATE DATABASE boilerplate_development;
-- CREATE USER bp_user WITH PASSWORD 'bp_password';
GRANT ALL PRIVILEGES ON DATABASE "boilerplate_development" to bp_user;
\connect boilerplate_development
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE DATABASE boilerplate_test;
GRANT ALL PRIVILEGES ON DATABASE "boilerplate_test" to bp_user;
\connect boilerplate_test
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;