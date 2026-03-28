from dataclasses import dataclass


@dataclass
class PreprocessorConfig:
    train_split: int = 80
    missing_strategy: str = "median"
    normalization: str = "zscore"
    imbalance_strategy: str = "smote"


class Preprocessor:
    def apply(self, config: PreprocessorConfig) -> dict[str, object]:
        train_rows = round(304 * (config.train_split / 100))
        return {
            "train_rows": train_rows,
            "test_rows": 304 - train_rows,
            "missing_strategy": config.missing_strategy,
            "normalization": config.normalization,
            "imbalance_strategy": config.imbalance_strategy,
        }
