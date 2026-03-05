import os

from sqlalchemy import create_engine, event
from sqlalchemy.ext.asyncio.session import AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from models import Base, Station

DATABASE_URL = os.environ.get(
    "DATABASE_URL", "sqlite+aiosqlite:///station-tracker.db"
)
engine = create_async_engine(DATABASE_URL, echo=False, pool_size=0)
async_session = async_sessionmaker(engine, expire_on_commit=False)


@event.listens_for(engine.sync_engine, "connect")
def on_engine_connect(dbapi_connection, _):
    dbapi_connection.execute("PRAGMA journal_mode=WAL")
    dbapi_connection.execute("PRAGMA foreign_keys=ON")

@event.listens_for(engine.sync_engine, "close")
def on_engine_close(dbapi_connection, _):
    dbapi_connection.execute("PRAGMA analysis_limit=1000")
    dbapi_connection.execute("PRAGMA optimize")

async def get_station(session: AsyncSession, station_id: int) -> Station | None:
    return await session.get(Station, station_id)
