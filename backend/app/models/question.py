from sqlalchemy import Boolean, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Question(Base):
    __tablename__ = "questions"
    __table_args__ = (UniqueConstraint("phase", "key", name="uq_questions_phase_key"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    phase: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    key: Mapped[str] = mapped_column(String(50), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    subtitle: Mapped[str] = mapped_column(Text, nullable=False, default="")
    question_type: Mapped[str] = mapped_column(String(20), nullable=False)
    multi: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    options: Mapped[list["AnswerOption"]] = relationship(
        back_populates="question",
        order_by="AnswerOption.sort_order",
        cascade="all, delete-orphan",
    )


class AnswerOption(Base):
    __tablename__ = "answer_options"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    question_id: Mapped[int] = mapped_column(ForeignKey("questions.id", ondelete="CASCADE"), nullable=False)
    option_key: Mapped[str] = mapped_column(String(50), nullable=False)
    label: Mapped[str] = mapped_column(String(255), nullable=False)
    icon: Mapped[str | None] = mapped_column(String(10), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    question: Mapped["Question"] = relationship(back_populates="options")
