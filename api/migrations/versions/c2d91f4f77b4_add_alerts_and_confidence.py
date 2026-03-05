"""Add alerts and confidence score

Revision ID: c2d91f4f77b4
Revises: b7f2e4b9c1a1
Create Date: 2026-02-25 08:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c2d91f4f77b4"
down_revision: Union[str, Sequence[str], None] = "b7f2e4b9c1a1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("tracks", sa.Column("confidence_score", sa.Float(), nullable=True))
    op.create_index("ix_tracks_confidence_score", "tracks", ["confidence_score"], unique=False)

    op.create_table(
        "alert_rules",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("query", sa.String(), nullable=False),
        sa.Column("station_id", sa.Integer(), nullable=True),
        sa.Column("min_interval_minutes", sa.Integer(), nullable=False, server_default="30"),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["station_id"], ["stations.id"], name="fk_alert_rules_station_id_stations_id"),
        sa.PrimaryKeyConstraint("id", name="pk_alert_rules"),
    )
    op.create_index("ix_alert_rules_enabled", "alert_rules", ["enabled"], unique=False)
    op.create_index("ix_alert_rules_station_id", "alert_rules", ["station_id"], unique=False)

    op.create_table(
        "alert_events",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("rule_id", sa.Integer(), nullable=False),
        sa.Column("station_id", sa.Integer(), nullable=False),
        sa.Column("track_id", sa.Integer(), nullable=False),
        sa.Column("message", sa.String(), nullable=False),
        sa.Column("metadata_json", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["rule_id"], ["alert_rules.id"], name="fk_alert_events_rule_id_alert_rules_id"),
        sa.ForeignKeyConstraint(["station_id"], ["stations.id"], name="fk_alert_events_station_id_stations_id"),
        sa.ForeignKeyConstraint(["track_id"], ["tracks.id"], name="fk_alert_events_track_id_tracks_id"),
        sa.PrimaryKeyConstraint("id", name="pk_alert_events"),
    )
    op.create_index("ix_alert_events_created_at", "alert_events", ["created_at"], unique=False)
    op.create_index("ix_alert_events_rule_id", "alert_events", ["rule_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_alert_events_rule_id", table_name="alert_events")
    op.drop_index("ix_alert_events_created_at", table_name="alert_events")
    op.drop_table("alert_events")

    op.drop_index("ix_alert_rules_station_id", table_name="alert_rules")
    op.drop_index("ix_alert_rules_enabled", table_name="alert_rules")
    op.drop_table("alert_rules")

    op.drop_index("ix_tracks_confidence_score", table_name="tracks")
    op.drop_column("tracks", "confidence_score")

