import os
from google import genai
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=api_key)

models_to_test = [
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-flash-lite-latest",
    "gemini-2.0-flash-lite",
    "gemini-flash-latest"
]

for m in models_to_test:
    try:
        response = client.models.generate_content(
            model=m,
            contents='Test message'
        )
        print(f"SUCCESS: {m}")
    except Exception as e:
        print(f"FAILED: {m} - {str(e)[:150]}")
