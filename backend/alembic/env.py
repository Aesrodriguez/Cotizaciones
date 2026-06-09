# Alembic configuration file
# This file contains settings for Alembic database migrations
# Documentation: https://alembic.sqlalchemy.org

import os
from logging.config import fileConfig
from sqlalchemy import engine_from_config
from sqlalchemy import pool
from alembic import context

# This is the Alembic Config object
config = context.config

# Interpret the config file for Python logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Add the models module to path to enable autogenerate
import sys
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)

# Import the declarative Base and all models for autogenerate
# This must be done AFTER adding to path
from app.models import Base

# Set the SQLAlchemy target metadata for 'autogenerate' support
target_metadata = Base.metadata

# Load database URL from environment variable
database_url = os.getenv(
    'DATABASE_URL',
    'postgresql://user:password@localhost:5432/triplaa_db'
)
# Render provides 'postgres://' but SQLAlchemy 2.0 requires 'postgresql://'
if database_url.startswith('postgres://'):
    database_url = database_url.replace('postgres://', 'postgresql://', 1)
config.set_main_option('sqlalchemy.url', database_url)


def run_migrations_offline() -> None:
    """
    Run migrations in 'offline' mode.
    
    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well. By skipping the Engine creation
    we don't even need a DBAPI to be available.
    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """
    Run migrations in 'online' mode.
    
    In this scenario we need to create an Engine
    and associate a connection with the context.
    """
    configuration = config.get_section(config.config_ini_section)
    configuration["sqlalchemy.url"] = database_url
    
    try:
        connectable = engine_from_config(
            configuration,
            prefix="sqlalchemy.",
            poolclass=pool.NullPool,
        )

        with connectable.connect() as connection:
            context.configure(
                connection=connection,
                target_metadata=target_metadata,
                render_as_batch=True,
            )

            with context.begin_transaction():
                context.run_migrations()
    except Exception as e:
        # If we can't connect, fall back to offline mode (for autogenerate)
        if "Connection refused" in str(e) or "operational" in str(e).lower():
            run_migrations_offline()
        else:
            raise


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
