import os
import sys

# Add backend directory to sys.path
sys.path.append(os.path.join(os.getcwd(), "backend-service"))

import pandas as pd
import numpy as np
from app.services.data_prep.step04_imputation import calculate_missing_statistics
from app.services.session_service import get_or_create
from app.core.config import settings
import tempfile
import json

session_id = "test-missing-2"

# Mock dataframe
df = pd.DataFrame({
    'Age': [25, np.nan, 30],
    'Name': ['Alice', 'Bob', np.nan]
})

s_dir = os.path.join("backend-service", "temp_sessions", session_id)
os.makedirs(s_dir, exist_ok=True)
df.to_csv(os.path.join(s_dir, "raw.csv"), index=False)

try:
    state = get_or_create(session_id)
    res = calculate_missing_statistics(session_id, [])
    print("SUCCESS")
    print(res)
    # Test JSON serialization to see if FastAPI will choke on it
    json.dumps(res)
    print("JSON SERIALIZATION SUCCESS")
except Exception as e:
    import traceback
    traceback.print_exc()
