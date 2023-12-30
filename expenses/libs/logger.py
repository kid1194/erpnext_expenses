# Expenses © 2024
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


import os
import logging
from logging.handlers import RotatingFileHandler

import frappe

from expenses import __abbr__


# [Common]
def get_logger(logType):
    if not logType:
        logType = "error"
    site = getattr(frappe.local, "site", None)
    if not site:
        site = "Frappe"

    logger_name = "{}-{}-{}".format(__abbr__, site, logType)

    try:
        return frappe.loggers[logger_name]
    except KeyError:
        pass

    logfile = "{}-{}.log".format(__abbr__, logType)
    log_filename = os.path.join("..", "logs", logfile)

    logger = logging.getLogger(logger_name)
    logger.setLevel(getattr(logging, logType.upper(), None) or logging.ERROR)
    logger.propagate = False
    
    handler = RotatingFileHandler(log_filename, maxBytes=100_000, backupCount=20)
    handler.setLevel(getattr(logging, logType.upper(), None) or logging.ERROR)
    handler.setFormatter(LoggingCustomFormatter())
    logger.addHandler(handler)

    frappe.loggers[logger_name] = logger

    return logger


# [Internal]
class LoggingCustomFormatter(logging.Formatter):
    def __init__(self):
        fmt = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        super(LoggingCustomFormatter, self).__init__(fmt)

    def format(self, record):
        return super().format(record)