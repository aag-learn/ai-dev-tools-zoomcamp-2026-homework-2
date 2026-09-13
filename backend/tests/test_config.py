from app.core.config import Settings


def test_database_url_defaults_to_sqlite_dev_db(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)

    assert Settings().database_url == "sqlite:///./dev.db"


def test_database_url_reflects_env_override(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql://user:pass@localhost/tally")

    assert Settings().database_url == "postgresql://user:pass@localhost/tally"
