import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / '.env')


@dataclass
class Settings:
    database_path: str = os.getenv('DATABASE_PATH', 'data/slothplan.db')
    api_base: str = os.getenv('GEMMA_API_BASE_URL', 'https://openrouter.ai/api/v1')
    api_key: str = os.getenv('GEMMA_API_KEY', '')
    model: str = os.getenv('GEMMA_MODEL', 'google/gemma-3-27b-it')
    provider: str = os.getenv('GEMMA_PROVIDER', 'OpenRouter')
    timeout: float = float(os.getenv('GEMMA_TIMEOUT_SECONDS', '25'))
    fallback: bool = os.getenv('ALLOW_RULE_FALLBACK', 'true').lower() == 'true'
    cors_origins: tuple[str, ...] = tuple(os.getenv(
        'CORS_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173'
    ).split(','))

    @property
    def db_path(self) -> Path:
        path = Path(self.database_path)
        return path if path.is_absolute() else ROOT / path
