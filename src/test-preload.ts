// Set test database URL before any test modules load
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
  ?? 'postgres://bp_user:bp_password@localhost:5432/boilerplate_test';
