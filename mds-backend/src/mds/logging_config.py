from __future__ import annotations

import logging
import sys

from mds.config import Settings

_LOG_FORMAT = "%(levelname)s %(name)s: %(message)s"


def configure_logging(settings: Settings) -> None:
    """Configure the ``mds`` logger tree for stderr output."""
    level_name = settings.effective_log_level
    level = getattr(logging, level_name, logging.INFO)

    mds_logger = logging.getLogger("mds")
    mds_logger.setLevel(level)

    for handler in list(mds_logger.handlers):
        if getattr(handler, "_mds_configured", False):
            mds_logger.removeHandler(handler)

    handler = logging.StreamHandler(sys.stderr)
    handler.setLevel(level)
    handler.setFormatter(logging.Formatter(_LOG_FORMAT))
    handler._mds_configured = True  # type: ignore[attr-defined]
    mds_logger.addHandler(handler)
    mds_logger.propagate = False
