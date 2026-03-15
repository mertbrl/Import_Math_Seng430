import pandas as pd
from sklearn.model_selection import train_test_split


def apply_data_split(df: pd.DataFrame, step: dict) -> dict[str, pd.DataFrame]:
    """
    Step 03 – Train / Validation / Test Split
    Applies a 2-way or 3-way split to the dataset.
    
    Expected step configuration:
    {
        "action": "split",
        "strategy": "2-way" | "3-way",
        "train": float (e.g., 0.8),
        "val": float (e.g., 0.1, or 0 if strategy is 2-way),
        "test": float (e.g., 0.1),
        "stratify": bool,
        "target": str (required if stratify is True, though we might need it globally; optionally passed here)
    }
    """
    strategy = step.get("strategy", "2-way")
    train_ratio = step.get("train", 0.8)
    val_ratio = step.get("val", 0.0)
    test_ratio = step.get("test", 0.2)
    stratify = step.get("stratify", False)
    target = step.get("target")

    stratify_col = df[target] if stratify and target and target in df.columns else None

    # Step 1: Split train and (val + test)
    remaining_ratio = val_ratio + test_ratio
    
    # Handle edge case where train is 100%
    if train_ratio >= 1.0 or remaining_ratio <= 0.0:
        return {"train": df, "val": pd.DataFrame(), "test": pd.DataFrame()}
    
    try:
        df_train, df_temp = train_test_split(
            df, 
            train_size=train_ratio, 
            stratify=stratify_col
        )
    except ValueError:
        # Fallback to random split if stratification fails
        df_train, df_temp = train_test_split(
            df, 
            train_size=train_ratio
        )

    if strategy == "2-way" or val_ratio <= 0.0:
        return {"train": df_train, "val": pd.DataFrame(), "test": df_temp}

    # Step 2: Split remaining into val and test
    relative_val_ratio = val_ratio / remaining_ratio
    
    # Determine stratify column for the remaining split
    temp_stratify_col = df_temp[target] if stratify and target and target in df_temp.columns else None

    try:
        df_val, df_test = train_test_split(
            df_temp, 
            train_size=relative_val_ratio, 
            stratify=temp_stratify_col
        )
    except ValueError:
        df_val, df_test = train_test_split(
            df_temp, 
            train_size=relative_val_ratio
        )

    return {"train": df_train, "val": df_val, "test": df_test}
