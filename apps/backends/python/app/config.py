import os
from dataclasses import dataclass

@dataclass
class Config:
    database_url: str
    tax_service_url: str
    log_level: str
    runtime_name: str
    listen_addr: str
    listen_port: int

def load_config() -> Config:
    return Config(
        database_url=os.getenv('DATABASE_URL', ''),
        tax_service_url=os.getenv('TAX_SERVICE_URL', 'http://tax-service:8080'),
        log_level=os.getenv('LOG_LEVEL', 'info'),
        runtime_name=os.getenv('RUNTIME_NAME', 'python'),
        listen_addr=os.getenv('LISTEN_ADDR', '0.0.0.0'),
        listen_port=int(os.getenv('LISTEN_PORT', '8080')),
    )
