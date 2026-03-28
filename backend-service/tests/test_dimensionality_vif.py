from pathlib import Path

import pandas as pd

from app.services.data_prep.step09_dimensionality import analyze_vif
from app.services.session_service import session_service

TEMP_SESSION_DIR = Path(__file__).resolve().parent.parent / "temp_sessions"


def test_analyze_vif_returns_uncapped_large_values_for_breast_dataset() -> None:
    session_service._sessions.clear()
    state = session_service.get_or_create("breast-vif")
    state.dataset = {
        "source": "default",
        "file_name": "oncology-breast.csv",
        "target_column": "Diagnosis",
    }

    result = analyze_vif("breast-vif")
    by_name = {row["column"]: row for row in result["columns"]}

    assert by_name["radius_mean"]["vif"] is not None
    assert by_name["radius_mean"]["vif"] > 1000
    assert by_name["perimeter_mean"]["vif"] is not None
    assert by_name["perimeter_mean"]["vif"] > 1000


def test_analyze_vif_excludes_numeric_target_and_identifier_columns() -> None:
    session_service._sessions.clear()
    state = session_service.get_or_create("vif-target-id")
    state.dataset = {
        "source": "upload",
        "file_name": "uploaded.csv",
        "target_column": "target",
    }

    df = pd.DataFrame(
        {
            "id": [1, 2, 3, 4, 5, 6],
            "feature_a": [10, 12, 14, 16, 18, 20],
            "feature_b": [20, 24, 28, 32, 36, 40],
            "target": [0, 1, 0, 1, 0, 1],
        }
    )

    session_dir = TEMP_SESSION_DIR / "vif-target-id"
    session_dir.mkdir(parents=True, exist_ok=True)
    df.to_csv(session_dir / "raw.csv", index=False)

    result = analyze_vif("vif-target-id")
    returned_columns = {row["column"] for row in result["columns"]}

    assert "id" not in returned_columns
    assert "target" not in returned_columns
    assert returned_columns == {"feature_a", "feature_b"}
