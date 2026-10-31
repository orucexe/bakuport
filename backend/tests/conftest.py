import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


@pytest.fixture
def settings():
    return Settings(database_url="sqlite:///:memory:", demo_mode=False, _env_file=None)


@pytest.fixture
def client(tmp_path):
    settings = Settings(database_url=f"sqlite:///{tmp_path / 'test.db'}", demo_mode=True, _env_file=None)
    app = create_app(settings)
    with TestClient(app) as client:
        yield client
