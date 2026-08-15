#!/usr/bin/env python3
"""Compatibility entrypoint for Study Bank Engine v5."""
from pathlib import Path
import runpy

runpy.run_path(str(Path(__file__).with_name("study-bank-engine-v5.py")), run_name="__main__")
