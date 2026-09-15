def test_openapi_json_returns_200(client):
    response = client.get("/openapi.json")

    assert response.status_code == 200
