import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os, uuid
from datetime import datetime, timezone

load_dotenv('.env')

async def seed():
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    db = client[os.environ['DB_NAME']]
    
    admin = await db.users.find_one({'role': 'admin'})
    admin_id = admin['id']
    
    # Seed listings
    existing = await db.listings.count_documents({})
    if existing == 0:
        listings = [
            {'id': str(uuid.uuid4()), 'title': '2 BHK Flat in Vesu', 'category': 'home', 'sub_category': '2bhk', 'listing_type': 'rent', 'price': 15000, 'location': 'Vesu', 'city': 'Surat', 'state': 'Gujarat', 'description': 'Beautiful 2 BHK flat in Vesu area. Well maintained with all amenities.', 'status': 'approved', 'is_available': True, 'owner_id': admin_id, 'owner_name': 'Admin', 'images': ['https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800'], 'amenities': ['Parking', 'Security', 'Lift'], 'views': 10, 'likes': 5, 'saves': 2, 'inquiries': 3, 'shares': 1, 'contact_phone': '9999999999', 'contact_email': 'admin@gharsetu.com', 'specifications': {}, 'nearby_facilities': {}, 'videos': [], 'created_at': datetime.now(timezone.utc).isoformat(), 'updated_at': datetime.now(timezone.utc).isoformat()},
            {'id': str(uuid.uuid4()), 'title': 'Shop for Rent - Adajan', 'category': 'business', 'sub_category': 'shop', 'listing_type': 'rent', 'price': 25000, 'location': 'Adajan', 'city': 'Surat', 'state': 'Gujarat', 'description': 'Prime location commercial shop in Adajan. Suitable for retail or office.', 'status': 'approved', 'is_available': True, 'owner_id': admin_id, 'owner_name': 'Admin', 'images': ['https://images.unsplash.com/photo-1582037928769-181f2644ecb7?w=800'], 'amenities': ['Parking', 'Security'], 'views': 8, 'likes': 3, 'saves': 1, 'inquiries': 2, 'shares': 0, 'contact_phone': '9999999999', 'contact_email': 'admin@gharsetu.com', 'specifications': {}, 'nearby_facilities': {}, 'videos': [], 'created_at': datetime.now(timezone.utc).isoformat(), 'updated_at': datetime.now(timezone.utc).isoformat()},
            {'id': str(uuid.uuid4()), 'title': 'Budget Hotel Room - Ring Road', 'category': 'stay', 'sub_category': 'hotel', 'listing_type': 'rent', 'price': 800, 'location': 'Ring Road', 'city': 'Surat', 'state': 'Gujarat', 'description': 'Clean and comfortable budget hotel room. AC, WiFi included.', 'status': 'approved', 'is_available': True, 'owner_id': admin_id, 'owner_name': 'Admin', 'images': ['https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800'], 'amenities': ['WiFi', 'AC', 'TV'], 'views': 15, 'likes': 7, 'saves': 3, 'inquiries': 5, 'shares': 2, 'contact_phone': '9999999999', 'contact_email': 'admin@gharsetu.com', 'specifications': {}, 'nearby_facilities': {}, 'videos': [], 'created_at': datetime.now(timezone.utc).isoformat(), 'updated_at': datetime.now(timezone.utc).isoformat()},
        ]
        await db.listings.insert_many(listings)
        print(f'✅ {len(listings)} listings added!')
    else:
        print(f'Listings already exist: {existing}')
    
    # Seed videos/reels
    existing_videos = await db.videos.count_documents({})
    if existing_videos == 0:
        videos = [
            {'id': str(uuid.uuid4()), 'owner_id': admin_id, 'owner_name': 'Admin', 'title': 'Beautiful 2BHK Tour', 'description': 'Virtual tour of 2BHK flat in Vesu', 'category': 'home', 'video_url': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', 'url': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', 'thumbnail_url': 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600', 'listing_id': '', 'tags': ['2bhk', 'vesu', 'surat'], 'likes': 12, 'views': 45, 'saves': 5, 'shares': 3, 'comments': [], 'created_at': datetime.now(timezone.utc).isoformat()},
            {'id': str(uuid.uuid4()), 'owner_id': admin_id, 'owner_name': 'Admin', 'title': 'Shop Space Walkthrough', 'description': 'Commercial shop in prime Adajan location', 'category': 'business', 'video_url': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', 'url': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', 'thumbnail_url': 'https://images.unsplash.com/photo-1582037928769-181f2644ecb7?w=600', 'listing_id': '', 'tags': ['shop', 'adajan', 'commercial'], 'likes': 8, 'views': 30, 'saves': 2, 'shares': 1, 'comments': [], 'created_at': datetime.now(timezone.utc).isoformat()},
        ]
        await db.videos.insert_many(videos)
        print(f'✅ {len(videos)} videos added!')
    else:
        print(f'Videos already exist: {existing_videos}')
    
    print('Done! Refresh your browser.')

asyncio.run(seed())