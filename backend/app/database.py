import os

from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import Session, sessionmaker

_raw_url = os.getenv(
    "DATABASE_URL",
    "postgresql://user:password@localhost:5432/cotizaciones_db",
)
DATABASE_URL = _raw_url.replace("postgres://", "postgresql://", 1)

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
    pool_recycle=300,
    echo=os.getenv("DATABASE_ECHO", "False").lower() == "true",
    future=True,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Session:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
