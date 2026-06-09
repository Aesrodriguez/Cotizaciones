from typing import TypeVar, Generic, Type, Optional, List
from uuid import UUID
from sqlalchemy.orm import Session
from app.models.base import Base

ModelType = TypeVar("ModelType", bound=Base)


class BaseRepository(Generic[ModelType]):
    def __init__(self, model: Type[ModelType], db: Session):
        self.model = model
        self.db = db

    def get(self, id: UUID) -> Optional[ModelType]:
        return self.db.query(self.model).filter(
            self.model.id == id,
            self.model.deleted_at.is_(None)
        ).first()

    def get_all(self, skip: int = 0, limit: int = 50) -> List[ModelType]:
        return self.db.query(self.model).filter(
            self.model.deleted_at.is_(None)
        ).offset(skip).limit(limit).all()

    def count(self) -> int:
        return self.db.query(self.model).filter(
            self.model.deleted_at.is_(None)
        ).count()

    def save(self, obj: ModelType) -> ModelType:
        self.db.add(obj)
        self.db.commit()
        self.db.refresh(obj)
        return obj

    def delete(self, obj: ModelType) -> None:
        from datetime import datetime, timezone
        obj.deleted_at = datetime.now(timezone.utc)
        self.db.commit()
