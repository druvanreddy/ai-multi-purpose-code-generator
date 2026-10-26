import os
from dotenv import load_dotenv

load_dotenv()


class Config:

    APP_NAME = os.getenv(
        "APP_NAME",
        "DMIXERAI"
    )

    VERSION = os.getenv(
        "VERSION",
        "1.0.0"
    )

    MODEL_NAME = os.getenv(
        "MODEL_NAME",
        "openai/gpt-oss-120b"
    )

    GROQ_API_KEY = os.getenv(
        "GROQ_API_KEY"
    )


config = Config()