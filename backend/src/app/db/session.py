from collections.abc import Iterator
from urllib.parse import urlsplit

from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.orm import sessionmaker

from app.core.config import Settings


def _connect_args_for(database_url: str) -> dict:
    """SQLite needs check_same_thread=False so the dev server and
    TestClient can share a connection across threads. Other backends
    (e.g. Postgres) don't need it and shouldn't carry it over.
    """
    if urlsplit(database_url).scheme == "sqlite":
        return {"check_same_thread": False}
    return {}


settings = Settings()

engine = create_engine(
    settings.database_url, connect_args=_connect_args_for(settings.database_url)
)

SessionLocal = sessionmaker(autoflush=False, bind=engine)


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
