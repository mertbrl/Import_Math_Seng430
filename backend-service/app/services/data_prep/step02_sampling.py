"""Step 02 – Sampling & Volume Management"""
from __future__ import annotations

from typing import Any

import pandas as pd


def apply_sampling(df: pd.DataFrame, config: dict[str, Any]) -> pd.DataFrame:
    """
    Apply sampling to the dataframe according to the config.

    Supported strategies:
    - "random"     : random sample without replacement (default)
    - "stratified" : stratified random sample preserving class proportions
    - "head"       : keep first N rows
    - "tail"       : keep last N rows

    Config keys:
        strategy  (str)   : sampling strategy, default "random"
        fraction  (float) : fraction of rows to keep, e.g. 0.8  (mutually exclusive with n)
        n         (int)   : absolute number of rows to keep      (mutually exclusive with fraction)
        target    (str)   : target column name (required for stratified)
        random_state (int): random seed for reproducibility, default 42
    """
    if not config.get("enabled", True):
        return df

    strategy = str(config.get("strategy", "random")).lower()
    fraction = config.get("fraction")
    n = config.get("n")
    target = config.get("target")
    random_state = int(config.get("random_state", 42))

    # Determine sample size
    if fraction is not None:
        fraction = max(0.0, min(1.0, float(fraction)))
        if fraction >= 1.0:
            return df
    elif n is not None:
        n = max(1, int(n))
        if n >= len(df):
            return df
    else:
        # No meaningful sampling configured — return unchanged
        return df

    if strategy == "stratified" and target and target in df.columns:
        # Stratified sample: maintain class proportions
        groups = []
        for _, group in df.groupby(target, observed=False):
            group_n = max(1, round((fraction or (n / len(df))) * len(group)))
            group_n = min(group_n, len(group))
            groups.append(group.sample(n=group_n, random_state=random_state))
        return pd.concat(groups).sample(frac=1, random_state=random_state).reset_index(drop=True)

    if strategy == "head":
        count = n if n is not None else max(1, round(float(fraction or 1.0) * len(df)))
        return df.head(count).reset_index(drop=True)

    if strategy == "tail":
        count = n if n is not None else max(1, round(float(fraction or 1.0) * len(df)))
        return df.tail(count).reset_index(drop=True)

    # Default: random
    if fraction is not None:
        return df.sample(frac=fraction, random_state=random_state).reset_index(drop=True)
    return df.sample(n=n, random_state=random_state).reset_index(drop=True)  # type: ignore[arg-type]
