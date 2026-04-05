import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import bcrypt, uuid
from datetime import datetime, timezone

async def create_admin():
    client = AsyncIOMotorClient('mongodb+srv://gharsetu_user:Gx6NZG2AXy3I73mu@gharsetu.j2r6umq.mongodb.net/gharsetu?retryWrites=true&w=majority&appName=gharsetu')
    db = client['gharsetu']
    
    existing = await db.users.find_one({'role': 'admin'})
    if existing:
        print('Admin already exists!')
        print('Email: admin@gharsetu.com')
        client.close()
        return
    
    pwd = bcrypt.hashpw('admin123'.encode(), bcrypt.gensalt()).decode()
    await db.users.insert_one({
        'id': str(uuid.uuid4()),
        'name': 'Admin',
        'email': 'admin@gharsetu.com',
        'password': pwd,
        'role': 'admin',
        'is_verified': True,
        'phone': '9999999999',
        'gender': 'male',
        'address': 'Surat',
        'city': 'Surat',
        'state': 'Gujarat',
        'created_at': datetime.now(timezone.utc).isoformat()
    })
    print('✅ Admin created successfully!')
    print('Email: admin@gharsetu.com')
    print('Password: admin123')
    client.close()

asyncio.run(create_admin())