"""
Endpoints package.

Avoid importing all endpoint modules at package import time.
Some endpoints depend on optional ML extras; importing eagerly can make
the whole app fail to start even when those endpoints are not wired.
"""

__all__ = []
