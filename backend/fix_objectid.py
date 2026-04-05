import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os

load_dotenv('.env')

async def fix():
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    db = client[os.environ['DB_NAME']]
    
    # Check what's in users collection
    users = await db.users.find({}).to_list(10)
    print(f"Total users: {len(users)}")
    for u in users:
        print(f"  - {u.get('email')} | role: {u.get('role')} | has_id: {'id' in u}")

asyncio.run(fix())