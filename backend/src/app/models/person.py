from sqlalchemy import Column
from sqlalchemy import Integer
from sqlalchemy import String

from app.db.base import Base


class Person(Base):
    __tablename__ = "people"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
