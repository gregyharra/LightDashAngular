import os

# Tests rely on demo seed data via app lifespan; opt in explicitly for test runs.
os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///:memory:")
os.environ.setdefault("SEED_DEMO_DATA", "true")
