import os
import sys
from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine, pool

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.models import Base

target_metadata = Base.metadata

_raw_url = os.environ["DATABASE_URL"]
DATABASE_URL = _raw_url.replace("postgres://", "postgresql://", 1)

_is_remote = "localhost" not in DATABASE_URL and "127.0.0.1" not in DATABASE_URL
_connect_args = {"sslmode": "require"} if _is_remote else {}


def run_migrations_online() -> None:
    connectable = create_engine(DATABASE_URL, poolclass=pool.NullPool, connect_args=_connect_args)
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()


run_migrations_online()
