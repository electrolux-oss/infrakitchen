from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from core.base_models import Base


class LabelsCRUD:
    def __init__(self, session: AsyncSession):
        self.session: AsyncSession = session

    def _get_all_subclasses(self, cls):
        all_subclasses = []
        for subclass in cls.__subclasses__():
            all_subclasses.append(subclass)
            all_subclasses.extend(self._get_all_subclasses(subclass))
        return all_subclasses

    async def aggregate_all_labels(self) -> list[str]:
        """Aggregate all unique labels from all models that have a labels field."""
        all_labels: set[str] = set()
        model_classes = self._get_all_subclasses(Base)

        for model_class in model_classes:
            if hasattr(model_class, "labels") and hasattr(model_class, "__tablename__"):
                stmt = (
                    select(func.json_array_elements_text(model_class.labels).label("label"))
                    .distinct()
                    .where(
                        and_(
                            model_class.labels.is_not(None),
                            func.json_typeof(model_class.labels) == "array",
                            func.json_array_length(model_class.labels) > 0,
                        )
                    )
                )

                result = await self.session.execute(stmt)
                labels_from_table = [row.label for row in result]
                all_labels.update(labels_from_table)

        return sorted(all_labels)

    async def get_labels(self, entity: str) -> list[str]:
        """
        Return all distinct labels for the given entity.
        Entity must match a known __tablename__ (see entities.py).
        """
        table_name = f"{entity}s"
        model_classes = self._get_all_subclasses(Base)
        target_cls = None

        for cls in model_classes:
            if getattr(cls, "__tablename__", None) == table_name:
                target_cls = cls
                break

        if target_cls is None or not hasattr(target_cls, "labels"):
            return []

        stmt = (
            select(func.json_array_elements_text(target_cls.labels).label("label"))
            .distinct()
            .where(
                and_(
                    target_cls.labels.is_not(None),
                    func.json_typeof(target_cls.labels) == "array",
                    func.json_array_length(target_cls.labels) > 0,
                )
            )
        )

        result = await self.session.execute(stmt)
        labels = {row.label for row in result}
        return sorted(labels)
