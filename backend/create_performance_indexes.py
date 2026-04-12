"""
Create production MongoDB indexes for high-traffic query paths.

Usage:
    python create_performance_indexes.py

Env vars required:
    MONGO_URL
    DB_NAME
"""

import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient


INDEX_PLAN = {
    "listings": [
        [("status", 1), ("is_available", 1), ("created_at", -1)],
        [("title", 1)],
        [("price", 1), ("created_at", -1)],
        [("location", 1)],
        [("owner_id", 1), ("created_at", -1)],
        [("title", 1), ("price", 1), ("location", 1), ("created_at", -1), ("owner_id", 1)],
        [("title", 1), ("price", 1), ("location", 1), ("createdAt", -1), ("userId", 1)],
    ],
    "videos": [
        [("created_at", -1)],
        [("title", 1)],
        [("location", 1)],
        [("owner_id", 1), ("created_at", -1)],
        [("title", 1), ("location", 1), ("created_at", -1), ("owner_id", 1)],
        [("title", 1), ("location", 1), ("createdAt", -1), ("userId", 1)],
    ],
    "users": [
        [("id", 1)],
        [("created_at", -1)],
        [("createdAt", -1)],
        [("userId", 1)],
    ],
    "wishlists": [
        [("user_id", 1), ("listing_id", 1)],
        [("user_id", 1), ("created_at", -1)],
        [("userId", 1), ("createdAt", -1)],
    ],
    "bookings": [
        [("user_id", 1), ("created_at", -1)],
        [("owner_id", 1), ("created_at", -1)],
    ],
    "reviews": [
        [("listing_id", 1), ("created_at", -1)],
        [("user_id", 1), ("created_at", -1)],
    ],
    "comments": [
        [("video_id", 1), ("created_at", -1)],
        [("user_id", 1), ("created_at", -1)],
    ],
}


async def create_indexes() -> None:
    mongo_url = os.environ["MONGO_URL"]
    db_name = os.environ["DB_NAME"]

    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    try:
        for collection_name, index_specs in INDEX_PLAN.items():
            collection = db[collection_name]
            for spec in index_specs:
                options = {}
                if any(field in {"createdAt", "userId"} for field, _ in spec):
                    options["sparse"] = True
                await collection.create_index(spec, **options)
                print(f"[OK] {collection_name}: {spec}")
    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(create_indexes())
