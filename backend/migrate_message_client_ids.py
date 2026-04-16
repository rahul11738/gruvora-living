"""
Backfill and enforce idempotency fields for chat messages.

Usage:
  python migrate_message_client_ids.py --batch-size 2000
  python migrate_message_client_ids.py --dry-run

This script:
1. Backfills missing/null/empty client_message_id as legacy-{message.id}
2. Drops legacy index variants
3. Creates partial unique idempotency index:
   (conversation_id, sender_id, client_message_id)
"""

import argparse
import asyncio
import os
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import DuplicateKeyError, OperationFailure

load_dotenv()

MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME", "gharsetu")
INDEX_NAME = "uq_messages_conversation_sender_client_msg_id"


async def backfill_missing_client_ids(db, batch_size: int, dry_run: bool) -> int:
    updated_total = 0

    while True:
        docs = (
            await db.messages.find(
                {
                    "$or": [
                        {"client_message_id": {"$exists": False}},
                        {"client_message_id": None},
                        {"client_message_id": ""},
                    ],
                    "id": {"$exists": True, "$ne": None},
                },
                {"_id": 1, "id": 1},
            )
            .limit(batch_size)
            .to_list(batch_size)
        )

        if not docs:
            break

        for item in docs:
            if dry_run:
                updated_total += 1
                continue
            await db.messages.update_one(
                {
                    "_id": item["_id"],
                    "$or": [
                        {"client_message_id": {"$exists": False}},
                        {"client_message_id": None},
                        {"client_message_id": ""},
                    ],
                },
                {"$set": {"client_message_id": f"legacy-{item.get('id')}"}},
            )
            updated_total += 1

        if len(docs) < batch_size:
            break

    return updated_total


async def rebuild_idempotency_index(db, dry_run: bool) -> None:
    for idx_name in [
        "conversation_id_1_sender_id_1_client_message_id_1",
        INDEX_NAME,
    ]:
        try:
            if not dry_run:
                await db.messages.drop_index(idx_name)
            print(f"[index] dropped if existed: {idx_name}")
        except (OperationFailure, Exception):
            pass

    if dry_run:
        print("[index] dry-run: skip create index")
        return

    await db.messages.create_index(
        [("conversation_id", 1), ("sender_id", 1), ("client_message_id", 1)],
        name=INDEX_NAME,
        unique=True,
        partialFilterExpression={
            "client_message_id": {
                "$exists": True,
                "$type": "string",
                "$ne": "",
            }
        },
    )
    print(f"[index] created: {INDEX_NAME}")


async def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill message client ids and rebuild index")
    parser.add_argument("--batch-size", type=int, default=2000)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    if not MONGO_URL:
        raise RuntimeError("MONGO_URL is not configured")

    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    try:
        print(f"[start] db={DB_NAME} batch_size={args.batch_size} dry_run={args.dry_run}")
        updated = await backfill_missing_client_ids(db, args.batch_size, args.dry_run)
        print(f"[backfill] updated={updated}")

        try:
            await rebuild_idempotency_index(db, args.dry_run)
        except DuplicateKeyError as exc:
            print(f"[index] duplicate conflict remains: {exc}")
            raise

        print("[done] migration completed")
    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(main())
