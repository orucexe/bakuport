from fastapi.testclient import TestClient
from app.config import Settings
from app.db import make_database
from app.main import create_app


def test_render_postgres_url_uses_installed_psycopg_driver():
    for url in ['postgres://user:pass@localhost/idda','postgresql://user:pass@localhost/idda']:
        engine,_=make_database(url)
        assert engine.url.drivername=='postgresql+psycopg'
        engine.dispose()


def test_vercel_origin_can_be_allowed_without_wildcard(tmp_path):
    settings=Settings(database_url=f"sqlite:///{tmp_path/'deploy.db'}",load_open_data=False,
                      cors_origins='https://idda-transit.vercel.app',_env_file=None)
    with TestClient(create_app(settings)) as client:
        headers={'Origin':'https://idda-transit.vercel.app','Access-Control-Request-Method':'POST',
                 'Access-Control-Request-Headers':'content-type'}
        response=client.options('/journeys/search',headers=headers)
        assert response.status_code==200
        assert response.headers['access-control-allow-origin']=='https://idda-transit.vercel.app'
        blocked=client.options('/journeys/search',headers={**headers,'Origin':'https://unknown.example'})
        assert 'access-control-allow-origin' not in blocked.headers
