"""
Identify slow MongoDB query shapes using explain(executionStats).

Usage:
    python identify_slow_queries.py

Env vars required:
    MONGO_URL
    DB_NAME
"""

import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient


QUERY_SHAPES = [
    {
        "name": "listings_main_feed",
        "collection": "listings",
        "filter": {"status": {"$in": ["approved", "boosted"]}, "is_available": True},
        "sort": [("created_at", -1)],
        "projection": {"_id": 0, "id": 1, "title": 1, "price": 1, "location": 1, "owner_id": 1, "created_at": 1},
        "limit": 20,
    },
    {
        "name": "videos_feed",
        "collection": "videos",
        "filter": {},
        "sort": [("created_at", -1)],
        "projection": {"_id": 0, "id": 1, "title": 1, "owner_id": 1, "created_at": 1, "likes": 1, "views": 1},
        "limit": 20,
    },
    {
        "name": "wishlist_by_user",
        "collection": "wishlists",
        "filter": {"user_id": "<sample-user-id>"},
        "sort": [("created_at", -1)],
        "projection": {"_id": 0, "listing_id": 1, "created_at": 1},
        "limit": 50,
    },
]


def summarize(shape_name: str, explain_doc: dict) -> None:
    stats = explain_doc.get("executionStats", {})
    stage = (
        explain_doc.get("queryPlanner", {})
        .get("winningPlan", {})
        .get("stage", "UNKNOWN")
    )
    n_returned = int(stats.get("nReturned", 0))
    docs_examined = int(stats.get("totalDocsExamined", 0))
    keys_examined = int(stats.get("totalKeysExamined", 0))
    ratio = (docs_examined / max(1, n_returned)) if n_returned else float(docs_examined)

    print(f"\n[{shape_name}]")
    print(f"  winning_stage: {stage}")
    print(f"  n_returned: {n_returned}")
    print(f"  total_docs_examined: {docs_examined}")
    print(f"  total_keys_examined: {keys_examined}")
    print(f"  docs_examined_per_result: {ratio:.2f}")

    if stage == "COLLSCAN" or ratio > 50:
        print("  recommendation: add/adjust compound index (equality -> sort -> range)")
    elif ratio > 10:
        print("  recommendation: improve projection or tighten filter to reduce scanned docs")
    else:
        print("  recommendation: query shape looks healthy")


async def main() -> None:
    mongo_url = os.environ["MONGO_URL"]
    db_name = os.environ["DB_NAME"]

    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    try:
        for shape in QUERY_SHAPES:
            cursor = db[shape["collection"]].find(shape["filter"], shape["projection"]) \
                .sort(shape["sort"]) \
                .limit(shape["limit"])
            explain_doc = await cursor.explain()
            summarize(shape["name"], explain_doc)
    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(main())
