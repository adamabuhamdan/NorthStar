import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "Social Media Filter API"
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_PRO_MODEL: str = "gemini-pro"
    GEMINI_VISION_MODEL: str = "gemini-pro-vision"
    CORS_ORIGINS: list = ["*"]  # للتنمية فقط
    MAX_FILE_SIZE: int = 20 * 1024 * 1024
    REQUEST_TIMEOUT: int = 60

settings = Settings()