"""Database connection and session management."""

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import NullPool

# Get database URL from environment or use default
DATABASE_URL = os.getenv(
    'DATABASE_URL',
    'postgresql://user:password@localhost:5432/triplaa_db'
)

# Create engine
# pool_pre_ping: Test connections before using them (helps with stale connections)
# echo: Log all SQL statements (disable in production)
engine = create_engine(
    DATABASE_URL,
    poolclass=NullPool if 'postgresql' in DATABASE_URL else None,
    echo=os.getenv('DATABASE_ECHO', 'False').lower() == 'true',
    future=True
)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Session:
    """
    Dependency for getting database session in FastAPI.
    
    Example:
        def my_endpoint(db: Session = Depends(get_db)):
            # Use db session
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
