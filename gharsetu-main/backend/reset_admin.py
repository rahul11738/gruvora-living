import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os, bcrypt

load_dotenv('.env')

async def reset():
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    db = client[os.environ['DB_NAME']]
    
    admin = await db.users.find_one({'role': 'admin'})
    if admin:
        print('Admin found:', admin['email'])
        new_pass = bcrypt.hashpw('Admin@123'.encode(), bcrypt.gensalt()).decode()
        await db.users.update_one({'role': 'admin'}, {'$set': {'password': new_pass}})
        print('Password reset to: Admin@123')
    else:
        print('No admin found!')

asyncio.run(reset())