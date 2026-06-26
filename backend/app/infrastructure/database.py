"""SQLAlchemy metadata baseline for Alembic migrations (S0-06).

Domain module models will register with this metadata in later sprints.
"""

from sqlalchemy import MetaData

# Naming convention for future Alembic autogenerate (Implementation Guide).
metadata = MetaData(
    naming_convention={
        "ix": "ix_%(column_0_label)s",
        "uq": "uq_%(table_name)s_%(column_0_name)s",
        "ck": "ck_%(table_name)s_%(constraint_name)s",
        "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
        "pk": "pk_%(table_name)s",
    }
)
