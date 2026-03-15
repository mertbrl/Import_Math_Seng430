"""
data_prep package
=================
Modular, SRP-compliant pipeline modules for Step 3: Data Preparation.

Public helpers
--------------
load_dataframe – shared CSV loader used by all step modules.
"""
from app.services.data_prep._dataframe_loader import load_dataframe  # noqa: F401

__all__ = ["load_dataframe"]
