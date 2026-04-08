"""
Targeted Cloudinary reel fix:
- Replace old/broken public_id with the correct public_id + version
- Rewrite canonical Cloudinary playback URL fields

Default mapping in this script:
  old_public_id: gharshetu/reels/f83a2271-c448-4c04-99ad-f2c3e4c8a06c
  new_public_id: gharshetu/reels/ggqemxl7p6kvyzl92hux
  version: 1775508039

Usage:
  python fix_specific_reel_public_id.py                 # dry-run
  python fix_specific_reel_public_id.py --apply         # apply updates
  python fix_specific_reel_public_id.py --apply --db-name gharsetu
"""

import argparse
import asyncio
import os
from typing import Dict, Any, List

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()

DEFAULT_OLD_PUBLIC_ID = "gharshetu/reels/f83a2271-c448-4c04-99ad-f2c3e4c8a06c"
DEFAULT_NEW_PUBLIC_ID = "gharshetu/reels/ggqemxl7p6kvyzl92hux"
DEFAULT_VERSION = 1775508039
DEFAULT_CLOUD_NAME = "dalkm3nih"


def build_video_url(cloud_name: str, public_id: str, version: int) -> str:
    return f"https://res.cloudinary.com/{cloud_name}/video/upload/v{int(version)}/{public_id}.mp4"


def build_thumb_url(cloud_name: str, public_id: str, version: int) -> str:
    return f"https://res.cloudinary.com/{cloud_name}/video/upload/v{int(version)}/{public_id}.jpg"


async def update_collection(
    collection,
    *,
    old_public_id: str,
    new_public_id: str,
    version: int,
    cloud_name: str,
    apply: bool,
) -> Dict[str, Any]:
    query = {
        "$or": [
            {"video_public_id": old_public_id},
            {"video_url": {"$regex": old_public_id}},
            {"url": {"$regex": old_public_id}},
        ]
    }

    docs: List[Dict[str, Any]] = await collection.find(query, {"_id": 1, "id": 1, "video_public_id": 1}).to_list(None)

    next_video_url = build_video_url(cloud_name, new_public_id, version)
    next_thumb_url = build_thumb_url(cloud_name, new_public_id, version)

    modified = 0
    for doc in docs:
        update_doc = {
            "$set": {
                "video_public_id": new_public_id,
                "video_version": int(version),
                "video_url": next_video_url,
                "url": next_video_url,
                "thumbnail_url": next_thumb_url,
            }
        }
        if apply:
            result = await collection.update_one({"_id": doc["_id"]}, update_doc)
            modified += int(result.modified_count or 0)

    return {
        "matched": len(docs),
        "modified": modified,
        "video_url": next_video_url,
        "thumbnail_url": next_thumb_url,
        "sample_ids": [d.get("id") for d in docs[:10]],
    }


async def main() -> None:
    parser = argparse.ArgumentParser(description="Fix a specific broken reel public_id and version in MongoDB")
    parser.add_argument("--apply", action="store_true", help="Actually update records. Without this flag, runs dry-run.")
    parser.add_argument("--old-public-id", default=DEFAULT_OLD_PUBLIC_ID)
    parser.add_argument("--new-public-id", default=DEFAULT_NEW_PUBLIC_ID)
    parser.add_argument("--version", type=int, default=DEFAULT_VERSION)
    parser.add_argument("--cloud-name", default=os.environ.get("CLOUDINARY_CLOUD_NAME", DEFAULT_CLOUD_NAME))
    parser.add_argument("--db-name", default=os.environ.get("DB_NAME") or os.environ.get("MONGO_DB_NAME") or "gharsetu")
    args = parser.parse_args()

    mongo_url = os.environ.get("MONGO_URL")
    if not mongo_url:
        raise RuntimeError("MONGO_URL is not set in environment or .env")

    client = AsyncIOMotorClient(mongo_url)
    db = client[args.db_name]

    try:
        mode = "APPLY" if args.apply else "DRY-RUN"
        print(f"Mode: {mode}")
        print(f"DB: {args.db_name}")

        videos_result = await update_collection(
            db.videos,
            old_public_id=args.old_public_id,
            new_public_id=args.new_public_id,
            version=args.version,
            cloud_name=args.cloud_name,
            apply=args.apply,
        )

        listings_result = await update_collection(
            db.listings,
            old_public_id=args.old_public_id,
            new_public_id=args.new_public_id,
            version=args.version,
            cloud_name=args.cloud_name,
            apply=args.apply,
        )

        print("\nCollection: videos")
        print(f"Matched: {videos_result['matched']}")
        print(f"Modified: {videos_result['modified']}")
        print(f"Sample IDs: {videos_result['sample_ids']}")

        print("\nCollection: listings")
        print(f"Matched: {listings_result['matched']}")
        print(f"Modified: {listings_result['modified']}")
        print(f"Sample IDs: {listings_result['sample_ids']}")

        print("\nCanonical URLs set to:")
        print(videos_result["video_url"])
        print(videos_result["thumbnail_url"])
    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(main())
