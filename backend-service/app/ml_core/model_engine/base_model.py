from abc import ABC, abstractmethod
from typing import Any


class BaseModelEngine(ABC):
    @abstractmethod
    def fit(self, features: list[list[float]], target: list[int]) -> None:
        raise NotImplementedError

    @abstractmethod
    def predict(self, features: list[list[float]]) -> list[int]:
        raise NotImplementedError

    @abstractmethod
    def get_params(self) -> dict[str, Any]:
        raise NotImplementedError
