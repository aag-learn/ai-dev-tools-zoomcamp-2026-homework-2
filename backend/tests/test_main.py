def test_openapi_json_returns_200(client):
    response = client.get("/openapi.json")

    assert response.status_code == 200


def test_docs_returns_200(client):
    response = client.get("/docs")

    assert response.status_code == 200
