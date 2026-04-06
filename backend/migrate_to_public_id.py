"""
Migration script: Extract public_id from existing Cloudinary URLs
Transform: Full URL → public_id storage
Example: https://res.cloudinary.com/dalkm3nih/video/upload/v123/gharsetu/reels/id.mp4
         → gharsetu/reels/id
"""
import asyncio
import os
import re
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URL = os.environ.get('MONGO_URL')
DB_NAME = os.environ.get('MONGO_DB_NAME', 'gharsetu')

async def extract_public_id_and_version(video_url):
    """
    Extract public_id from Cloudinary URL
    Pattern: https://res.cloudinary.com/{cloud}/video/upload/{version}/{public_id}.{ext}
    Returns: tuple(public_id, version)
    """
    if not video_url:
        return None, None
    
    # Match pattern: /upload/{version}/{public_id}.{ext}
    # Also handle: /upload/{public_id}.{ext} (no version)
    match = re.search(r'/upload/(?:v(\d+)/)?(.+?)\.(mp4|webm|mov|avi|flv)', video_url)
    if match:
        version = int(match.group(1)) if match.group(1) else None
        public_id = match.group(2)
        return public_id, version
    
    return None, None


async def migrate_videos():
    """Migrate videos collection to extract public_id"""
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    collection = db.videos
    
    # Find all videos with video_url that don't have video_public_id yet
    videos = await collection.find({
        "video_url": {"$exists": True},
        "video_public_id": {"$exists": False}
    }).to_list(None)
    
    print(f"Found {len(videos)} videos to migrate")
    
    migrated = 0
    failed = []
    
    for video in videos:
        video_url = video.get("video_url", "")
        public_id, version = await extract_public_id_and_version(video_url)
        
        if public_id:
            # Update video document
            result = await collection.update_one(
                {"_id": video["_id"]},
                {
                    "$set": {
                        "video_public_id": public_id,
                        "video_version": version,
                        # Also clean up video_url if it's a full URL
                        "video_url": public_id
                    }
                }
            )
            migrated += 1
            print(f"✓ Migrated: {video['id']} → {public_id} (v{version})")
        else:
            failed.append({
                "id": video.get("id"),
                "url": video_url
            })
            print(f"✗ Failed to extract: {video['id']} from {video_url}")
    
    print(f"\n📊 Migration Summary:")
    print(f"✅ Migrated: {migrated}")
    print(f"❌ Failed: {len(failed)}")
    
    if failed:
        print(f"\nFailed videos:")
        for item in failed:
            print(f"  - {item['id']}: {item['url']}")


async def migrate_listings():
    """Migrate listings with stored video URLs"""
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    collection = db.listings
    
    # Find all listings with video_url
    documents = await collection.find({
        "video_url": {"$exists": True, "$ne": ""}
    }).to_list(None)
    
    print(f"\nFound {len(documents)} listings with video URLs")
    
    migrated = 0
    
    for doc in documents:
        video_url = doc.get("video_url", "")
        public_id, version = await extract_public_id_and_version(video_url)
        
        if public_id:
            result = await collection.update_one(
                {"_id": doc["_id"]},
                {
                    "$set": {
                        "video_public_id": public_id,
                        "video_version": version,
                        "video_url": public_id
                    }
                }
            )
            migrated += 1
            print(f"✓ Migrated listing: {doc.get('_id')} → {public_id} (v{version})")
    
    print(f"✅ Listings migrated: {migrated}")


async def main():
    print("🚀 Starting Cloudinary public_id migration...\n")
    await migrate_videos()
    await migrate_listings()
    print("\n✅ Migration complete!")


if __name__ == "__main__":
    asyncio.run(main())
