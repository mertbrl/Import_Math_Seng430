import pandas as pd
from sklearn.model_selection import train_test_split


def apply_sampling(df: pd.DataFrame, step: dict) -> pd.DataFrame:
    """
    Step 02 – Sampling & Volume Management
    Applies random or stratified sampling to the given DataFrame based on the configuration.
    
    Expected step configuration:
    {
        "action": "sample",
        "method": "random" | "stratified",
        "fraction": float (e.g., 0.15 for 15%),
        "target": str (required if method is 'stratified')
    }
    """
    frac = step.get("fraction", 1.0)
    
    if frac >= 1.0:
        return df

    target = step.get("target")
    method = step.get("method", "random")

    if method == "stratified" and target and target in df.columns:
        try:
            # We use train_split as the 'keep' fraction
            df_sampled, _ = train_test_split(df, train_size=frac, stratify=df[target])
            return df_sampled
        except ValueError:
            # Fallback to random sampling if stratification fails (e.g., class with only 1 sample)
            return df.sample(frac=frac)
    else:
        # Default to random sampling
        return df.sample(frac=frac)
