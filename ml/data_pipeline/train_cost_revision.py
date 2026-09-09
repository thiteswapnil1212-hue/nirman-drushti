"""Train and persist the leakage-safe future reported cost-revision model."""

from __future__ import annotations

import argparse
import logging
from pathlib import Path

from app.db.session import SessionLocal
from app.services.cost_prediction import ARTIFACT_PATH, build_training_dataset, save_artifact, train_model

LOGGER = logging.getLogger(__name__)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--artifact", type=Path, default=ARTIFACT_PATH)
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    with SessionLocal() as database:
        dataset = build_training_dataset(database)
        model = train_model(dataset)
        save_artifact(model, args.artifact)
    LOGGER.info("trained %s rows: train=%s validation=%s test=%s metrics=%s", len(dataset.rows), model.train_rows, model.validation_rows, model.test_rows, model.metrics)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
