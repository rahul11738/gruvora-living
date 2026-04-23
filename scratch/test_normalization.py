import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from pathlib import Path
from datetime import datetime, timezone

async def test_status_normalization():
    ROOT_DIR = Path(__file__).parent.parent / "backend"
    load_dotenv(ROOT_DIR / ".env")
    
    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME", "gharsetu")
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    # We'll simulate the normalization logic from the backend
    email = "mahavir01@gmail.com"
    user = await db.users.find_one({"email": email})
    
    if user:
        plan = user.get("subscription_plan", "basic")
        print(f"DB Plan: {plan}")
        
        # Simulated Backend Logic
        from enum import Enum
        class SubscriptionPlan(str, Enum):
            BASIC = "basic"
            PRO = "pro"
            ADVANCED = "advanced"
            UNLIMITED = "unlimited"
            
        try:
            current_plan = SubscriptionPlan(plan)
            normalized_plan = current_plan.value
        except ValueError:
            normalized_plan = "basic"
            
        print(f"Normalized Plan: {normalized_plan}")
        
        # Test if it matches one of the frontend's 3 plans
        frontend_plans = ["basic", "pro", "advanced"]
        if normalized_plan in frontend_plans:
            print("SUCCESS: Normalized plan matches frontend IDs")
        else:
            # If it's still 'unlimited', it will fail in the UI unless mapped
            print(f"WARNING: Normalized plan '{normalized_plan}' is NOT in frontend plans")
    else:
        print("User not found")

if __name__ == "__main__":
    asyncio.run(test_status_normalization())
