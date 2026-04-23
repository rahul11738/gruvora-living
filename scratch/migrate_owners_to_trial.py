import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from pathlib import Path
from datetime import datetime, timezone, timedelta

async def migrate_owners():
    ROOT_DIR = Path(__file__).parent.parent / "backend"
    load_dotenv(ROOT_DIR / ".env")
    
    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME", "gharsetu")
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    # Supported subscription roles
    SUBSCRIPTION_ROLES = ["property_owner", "stay_owner", "event_owner", "hotel_owner"]
    
    cursor = db.users.find({"role": {"$in": SUBSCRIPTION_ROLES}})
    count = 0
    
    async for user in cursor:
        email = user.get("email")
        created_at_str = user.get("created_at")
        
        if created_at_str:
            try:
                created_at = datetime.fromisoformat(created_at_str.replace("Z", "+00:00"))
            except ValueError:
                created_at = datetime.now(timezone.utc)
        else:
            created_at = datetime.now(timezone.utc)
            
        trial_end = created_at + timedelta(days=152) # approx 5 months
        now = datetime.now(timezone.utc)
        
        status = "trial" if trial_end > now else "expired"
        
        # We only want to migrate users who don't have a valid new plan yet, 
        # or who have legacy plans like 'unlimited'
        current_plan = user.get("subscription_plan")
        valid_plans = ["basic", "pro", "advanced", "service_basic", "service_verified", "service_top"]
        
        if current_plan not in valid_plans:
            update_data = {
                "subscription": status,
                "subscription_status": status,
                "subscription_plan": "basic",
                "trial_end_date": trial_end.isoformat(),
                "next_billing_date": trial_end.isoformat(),
                "subscription_model": "subscription",
            }
            
            await db.users.update_one({"id": user.get("id")}, {"$set": update_data})
            print(f"Migrated {email}: status={status}, trial_end={trial_end.date()}")
            count += 1
        else:
            print(f"Skipping {email}: already has valid plan '{current_plan}'")
            
    print(f"\nMigration complete. Total updated: {count}")

if __name__ == "__main__":
    asyncio.run(migrate_owners())
