#!/usr/bin/env python
"""Backward-compatible entry point for the CodeWatch CV engine.

The engine was refactored into the ``FinalSystem/`` package. This shim keeps the historical
``python FinalSystem.py`` invocation working (launcher, desktop shortcut, muscle memory) by
delegating to ``FinalSystem.main``. The preferred entry point is ``python -m FinalSystem.main``.
The original monolithic engine is preserved alongside this file as ``FinalSystem.py.bak``.

Note: a same-named package (``FinalSystem/``) takes import precedence over this module, so
``import FinalSystem`` / ``from FinalSystem import ...`` always resolve to the package; this file
only runs when executed directly as a script.
"""
import os
import sys

# Ensure this directory (BackEnd) is on sys.path so the FinalSystem package and the sibling
# `liveness` package resolve regardless of the working directory the engine is launched from.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from FinalSystem.main import main

if __name__ == "__main__":
    main()
