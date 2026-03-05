from datetime import datetime


from sqlalchemy import (
    Column,
    Index,
    Integer,
    Float,
    PrimaryKeyConstraint,
    String,
    Boolean,
    DateTime,
    Text,
    ForeignKey,
)
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class Station(Base):
    __tablename__ = "stations"

    id = Column[int](Integer, nullable=False)
    name = Column(String, nullable=False)
    url = Column[str](String, nullable=False)
    logo_url = Column[str](String, nullable=True)
    enabled = Column(Boolean, nullable=False)
    interval = Column[int](Integer, nullable=False)
    skip_seconds = Column[int](Integer, nullable=False, server_default="0")
    last_run_at = Column[datetime](DateTime, nullable=True)
    error_message = Column[str](String, nullable=True)
    created_at = Column[datetime](DateTime(), nullable=False)
    updated_at = Column[datetime](DateTime(), nullable=False)
    PrimaryKeyConstraint(id, name="pk_stations")


class Track(Base):
    __tablename__ = "tracks"

    id = Column[int](Integer, nullable=False)
    shazam_url = Column[str](String, nullable=False)
    title = Column[str](String, nullable=False)
    artist = Column[str](String, nullable=True)
    album = Column[str](String, nullable=True)
    year = Column[int](Integer, nullable=True)
    genre = Column[str](String, nullable=True)
    cover_url = Column[str](String, nullable=True)
    preview_url = Column[str](String, nullable=True)
    confidence_score = Column[float](Float, nullable=True)
    favorite_at = Column[datetime](DateTime, nullable=True)
    created_at = Column[datetime](DateTime, nullable=False)
    PrimaryKeyConstraint(id, name="pk_tracks")


class Play(Base):
    __tablename__ = "plays"

    id = Column[int](Integer, nullable=False)
    station_id = Column[int](Integer, ForeignKey("stations.id", name="fk_plays_station_id_stations_id"), nullable=False)
    track_id = Column[int](Integer, ForeignKey("tracks.id", name="fk_plays_track_id_tracks_id"), nullable=False)
    created_at = Column[datetime] (DateTime, nullable=False)
    PrimaryKeyConstraint(id, name="pk_plays")


class AlertRule(Base):
    __tablename__ = "alert_rules"

    id = Column[int](Integer, nullable=False)
    name = Column[str](String, nullable=False)
    query = Column[str](String, nullable=False)
    station_id = Column[int](Integer, ForeignKey("stations.id", name="fk_alert_rules_station_id_stations_id"), nullable=True)
    min_interval_minutes = Column[int](Integer, nullable=False, server_default="30")
    enabled = Column[bool](Boolean, nullable=False, server_default="1")
    created_at = Column[datetime](DateTime, nullable=False)
    updated_at = Column[datetime](DateTime, nullable=False)
    PrimaryKeyConstraint(id, name="pk_alert_rules")


class AlertEvent(Base):
    __tablename__ = "alert_events"

    id = Column[int](Integer, nullable=False)
    rule_id = Column[int](Integer, ForeignKey("alert_rules.id", name="fk_alert_events_rule_id_alert_rules_id"), nullable=False)
    station_id = Column[int](Integer, ForeignKey("stations.id", name="fk_alert_events_station_id_stations_id"), nullable=False)
    track_id = Column[int](Integer, ForeignKey("tracks.id", name="fk_alert_events_track_id_tracks_id"), nullable=False)
    message = Column[str](String, nullable=False)
    metadata_json = Column[str](Text, nullable=True)
    created_at = Column[datetime](DateTime, nullable=False)
    PrimaryKeyConstraint(id, name="pk_alert_events")


# Indexes defined at module level so Alembic autogenerate detects them
Index("ix_stations_enabled", Station.enabled)
Index("ix_tracks_favorite_at", Track.favorite_at)
Index("ix_tracks_confidence_score", Track.confidence_score)
Index("ix_plays_track_id", Play.track_id)
Index("ix_plays_station_id", Play.station_id)
Index("ix_plays_created_at", Play.created_at)
Index("ix_plays_station_id_created_at", Play.station_id, Play.created_at)
Index("ix_alert_rules_enabled", AlertRule.enabled)
Index("ix_alert_rules_station_id", AlertRule.station_id)
Index("ix_alert_events_created_at", AlertEvent.created_at)
Index("ix_alert_events_rule_id", AlertEvent.rule_id)
