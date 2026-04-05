import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def fix():
    client = AsyncIOMotorClient('mongodb+srv://gharsetu_user:Gx6NZG2AXy3I73mu@gharsetu.j2r6umq.mongodb.net/gharsetu?retryWrites=true&w=majority&appName=gharsetu')
    db = client['gharsetu']
    
    working_videos = [
        "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
        "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
        "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4",
        "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4",
    ]
    
    videos = await db.videos.find({}).to_list(100)
    print(f"Found {len(videos)} videos")
    
    for i, video in enumerate(videos):
        url = working_videos[i % len(working_videos)]
        await db.videos.update_one(
            {'id': video['id']},
            {'$set': {'video_url': url, 'url': url}}
        )
        print(f"✅ Updated: {video.get('title', 'Unknown')}")
    
    print("Done!")
    client.close()

asyncio.run(fix())