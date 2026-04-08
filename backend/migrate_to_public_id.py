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

def extract_public_id_and_version(video_url):
    """
    Extract public_id from Cloudinary URL
    Pattern: https://res.cloudinary.com/{cloud}/video/upload/{version}/{public_id}.{ext}
    Returns: tuple(public_id, version)
    """
    if not video_url:
        return None, None
    
    text = str(video_url).strip().replace('http://', 'https://', 1)

    # Already stored as public_id (best-practice format).
    if not text.startswith('http://') and not text.startswith('https://'):
        candidate = text.split('?', 1)[0].strip('/').rsplit('.', 1)[0]
        if not candidate:
            return None, None
        if '/' in candidate and re.fullmatch(r'v\d+', candidate.split('/', 1)[0]):
            version_part, public_id = candidate.split('/', 1)
            return public_id, int(version_part[1:])
        return candidate, None

    if 'res.cloudinary.com' not in text or '/video/upload/' not in text:
        return None, None

    tail = text.split('/video/upload/', 1)[1].split('?', 1)[0]
    parts = [part for part in tail.split('/') if part]
    if not parts:
        return None, None

    version = None
    version_idx = None
    for idx, part in enumerate(parts):
        if re.fullmatch(r'v\d+', part):
            version = int(part[1:])
            version_idx = idx
            break

    public_parts = parts[version_idx + 1:] if version_idx is not None else list(parts)

    if version_idx is None:
        def _is_transformation_segment(segment: str) -> bool:
            if not segment:
                return False
            tokens = segment.split(',')
            return all(re.fullmatch(r'[a-z]{1,5}_.+', token, flags=re.IGNORECASE) for token in tokens)

        while public_parts and _is_transformation_segment(public_parts[0]):
            public_parts.pop(0)

    if not public_parts:
        return None, version

    public_parts[-1] = public_parts[-1].rsplit('.', 1)[0]
    public_id = '/'.join(public_parts).strip('/')
    if not public_id:
        return None, version

    return public_id, version


async def migrate_videos():
    """Migrate videos collection to extract public_id"""
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    collection = db.videos
    
    # Find all videos that still have URL-style storage or missing canonical identifiers.
    videos = await collection.find({
        "$or": [
            {"video_public_id": {"$exists": False}},
            {"video_public_id": {"$in": [None, ""]}},
            {"video_url": {"$regex": r"^https?://", "$options": "i"}},
            {"url": {"$regex": r"^https?://res\.cloudinary\.com/.+/video/upload/", "$options": "i"}},
        ]
    }).to_list(None)
    
    print(f"Found {len(videos)} videos to migrate")
    
    migrated = 0
    failed = []
    
    for video in videos:
        source_url = video.get("video_url") or video.get("url")
        public_id, version = extract_public_id_and_version(source_url)
        
        if public_id:
            # Update video document
            result = await collection.update_one(
                {"_id": video["_id"]},
                {
                    "$set": {
                        "video_public_id": public_id,
                        "video_version": version,
                        "video_url": public_id,
                        "url": (
                            f"https://res.cloudinary.com/dalkm3nih/video/upload/v{version}/{public_id}.mp4"
                            if version is not None
                            else f"https://res.cloudinary.com/dalkm3nih/video/upload/{public_id}.mp4"
                        ),
                    }
                }
            )
            migrated += 1
            print(f"✓ Migrated: {video.get('id')} → {public_id} (v{version})")
        else:
            failed.append({
                "id": video.get("id"),
                "url": source_url
            })
            print(f"✗ Failed to extract: {video.get('id')} from {source_url}")
    
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
        public_id, version = extract_public_id_and_version(video_url)
        
        if public_id:
            result = await collection.update_one(
                {"_id": doc["_id"]},
                {
                    "$set": {
                        "video_public_id": public_id,
                        "video_version": version,
                        "video_url": public_id,
                        "url": (
                            f"https://res.cloudinary.com/dalkm3nih/video/upload/v{version}/{public_id}.mp4"
                            if version is not None
                            else f"https://res.cloudinary.com/dalkm3nih/video/upload/{public_id}.mp4"
                        ),
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
