import logging
import sys

logger = logging.getLogger("sentinel")
logger.setLevel(logging.INFO)
_handler = logging.StreamHandler(sys.stdout)
_handler.setFormatter(logging.Formatter('{"time":"%(asctime)s","level":"%(levelname)s","logger":"%(name)s","msg":"%(message)s"}'))
if not logger.handlers:
    logger.addHandler(_handler)
