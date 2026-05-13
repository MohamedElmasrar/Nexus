from app.models.base import engine
from sqlalchemy import text

with engine.connect() as con:
    con.execute(text('DELETE FROM alembic_version;'))
    con.commit()
