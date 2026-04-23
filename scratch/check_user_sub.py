import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from pathlib import Path

async def check_user():
    ROOT_DIR = Path(__file__).parent.parent / "backend"
    load_dotenv(ROOT_DIR / ".env")
    
    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME", "gharsetu")
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    email = "mahavir01@gmail.com"
    user = await db.users.find_one({"email": email})
    
    if user:
        print(f"User: {user.get('email')}")
        print(f"Role: {user.get('role')}")
        print(f"Subscription: {user.get('subscription')}")
        print(f"Sub Status: {user.get('subscription_status')}")
        print(f"Sub Plan: {user.get('subscription_plan')}")
        print(f"Trial End: {user.get('trial_end_date')}")
        print(f"Next Billing: {user.get('next_billing_date')}")
    else:
        print(f"User {email} not found in database '{db_name}'")

if __name__ == "__main__":
    asyncio.run(check_user())
