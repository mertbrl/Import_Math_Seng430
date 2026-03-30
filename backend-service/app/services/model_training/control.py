from __future__ import annotations

from collections.abc import Callable

ShouldCancel = Callable[[], bool]


class TrainingCancelledError(Exception):
    """Raised when a training task is cancelled by the user."""


def raise_if_cancelled(should_cancel: ShouldCancel | None) -> None:
    if should_cancel and should_cancel():
        raise TrainingCancelledError("Training was cancelled.")
