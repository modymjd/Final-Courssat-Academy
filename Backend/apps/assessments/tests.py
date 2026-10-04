"""
Compatibility shim for historical imports.

The real assessment tests live in the adjacent ``tests/`` directory. Defining
``__path__`` makes this module package-like, so existing commands such as
``manage.py test apps.assessments.tests.test_exam_access`` continue to work
without keeping duplicate test classes in two locations.
"""

from pathlib import Path

__path__ = [str(Path(__file__).with_suffix(""))]
