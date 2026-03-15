import requests

response = requests.post(
    "http://localhost:8000/api/v1/outliers-stats",
    json={"session_id": "demo-session", "excluded_columns": []}
)

print(f"Status Code: {response.status_code}")
try:
    print(response.json())
except Exception as e:
    print(response.text)
