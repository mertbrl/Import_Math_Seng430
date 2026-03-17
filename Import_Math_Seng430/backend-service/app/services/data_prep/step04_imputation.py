"""
Step 04 – Imputation (Missing Data Stats)
Single Responsibility: Dynamically calculate missing value statistics from the dataset.
Filters out columns with zero missing values and returns percentages.
"""
from typing import Any
import math

from app.core.exceptions import PipelineError
from app.services.data_prep._dataframe_loader import load_dataframe

def calculate_missing_statistics(session_id: str, excluded_columns: list[str]) -> list[dict[str, Any]]:
    """
    Returns a list of dictionaries containing missing value statistics for each column.
    Only includes columns that actually have missing values.
    """
    try:
        df = load_dataframe(session_id)
        existing_excludes = [str(col) for col in excluded_columns if col in df.columns]
        df_working = df.drop(columns=existing_excludes) if existing_excludes else df.copy()
        
        total_rows = int(len(df_working))
        if total_rows == 0:
            return []
            
        missing_stats = df_working.isnull().sum()
        
        result = []
        for col, count in missing_stats.items():
            # Safely cast scalar values to native Python types
            native_count = int(count)
            if native_count > 0:
                dtype_str = str(df_working[col].dtype).lower()
                
                # Determine basic clinical type representation
                col_type = "Numeric" if "int" in dtype_str or "float" in dtype_str else "Categorical"
                
                # Prevent any potential Division By Zero or float serialization issues
                raw_pct = (native_count / float(total_rows)) * 100.0
                if math.isnan(raw_pct) or math.isinf(raw_pct):
                    missing_pct = 0.0
                else:
                    missing_pct = round(raw_pct, 2)
                
                result.append({
                    "column": str(col),  # STRICT NATIVE STRING
                    "missing_count": native_count,  # STRICT NATIVE INT
                    "missing_percentage": float(missing_pct),  # STRICT NATIVE FLOAT
                    "type": str(col_type)  # STRICT NATIVE STRING
                })
                
        return result
        
    except Exception as exc:
        # Wrap all exceptions natively as strings to avoid nested error casting failures
        err_msg = str(exc)
        raise PipelineError(f"Calculating missing stats failed: {err_msg}", status_code=400)
