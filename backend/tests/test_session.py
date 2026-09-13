from app.db.session import _connect_args_for, engine


def test_connect_args_include_check_same_thread_for_sqlite():
    assert _connect_args_for("sqlite:///./dev.db") == {"check_same_thread": False}


def test_connect_args_are_empty_for_non_sqlite_urls():
    assert _connect_args_for("postgresql://user:pass@localhost/tally") == {}


def test_engine_is_constructed_from_settings_database_url():
    assert str(engine.url) == "sqlite:///./dev.db"
