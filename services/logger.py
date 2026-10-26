"""
DMIXERAI
Logger Service
"""

from datetime import datetime
from pathlib import Path


class Logger:

    def __init__(self):

        self.log_folder = Path("logs")
        self.log_folder.mkdir(exist_ok=True)

        self.log_file = self.log_folder / "application.log"

    # ----------------------------------------

    def write(self, level, message):

        timestamp = datetime.now().strftime(
            "%d-%m-%Y %H:%M:%S"
        )

        with open(

            self.log_file,

            "a",

            encoding="utf-8"

        ) as file:

            file.write(

                f"[{timestamp}] [{level}] {message}\n"

            )

    # ----------------------------------------

    def info(self, message):

        self.write(

            "INFO",

            message

        )

    # ----------------------------------------

    def success(self, message):

        self.write(

            "SUCCESS",

            message

        )

    # ----------------------------------------

    def warning(self, message):

        self.write(

            "WARNING",

            message

        )

    # ----------------------------------------

    def error(self, message):

        self.write(

            "ERROR",

            message

        )

    # ----------------------------------------

    def clear_logs(self):

        with open(

            self.log_file,

            "w",

            encoding="utf-8"

        ) as file:

            file.write("")


logger = Logger()