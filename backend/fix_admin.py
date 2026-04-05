import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os, bcrypt, uuid

load_dotenv('.env')

async def fix():
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    db = client[os.environ['DB_NAME']]
    
    # Delete old admin
    await db.users.delete_many({'role': 'admin'})
    print('Old admin deleted')
    
    # Create fresh admin with proper 'id' field
    admin_id = str(uuid.uuid4())
    new_pass = bcrypt.hashpw('Admin@123'.encode(), bcrypt.gensalt()).decode()
    
    admin_doc = {
        'id': admin_id,
        'name': 'Admin',
        'email': 'admin@gharsetu.com',
        'phone': '9999999999',
        'password': new_pass,
        'gender': 'male',
        'address': 'Surat',
        'city': 'Surat',
        'state': 'Gujarat',
        'role': 'admin',
        'is_verified': True,
    }
    
    await db.users.insert_one(admin_doc)
    print('New admin created!')
    print('Email: admin@gharsetu.com')
    print('Password: Admin@123')

asyncio.run(fix())