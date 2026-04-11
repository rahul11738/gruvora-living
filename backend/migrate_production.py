import os
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone, timedelta
import logging
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Constants (matching server.py logic)
SUBSCRIPTION_AMOUNT_PAISE = 99900
COMMISSION_RATE = 0.02

def _add_months(source_date, months):
    month = source_date.month - 1 + months
    year = source_date.year + month // 12
    month = month % 12 + 1
    day = min(source_date.day, 28) # Simple safe day
    return source_date.replace(year=year, month=month, day=day)

def normalize_role(role):
    if not role: return ""
    return str(role).lower().strip().replace(" ", "_")

async def run_migration():
    mongo_url = os.environ.get("MONGO_URL")
    
    if not mongo_url:
        logger.error("MONGO_URL environment variable not found!")
        print("\nFix: Set it in your .env file or run this in PowerShell first:")
        print('$env:MONGO_URL="your_mongodb_url_here"')
        return

    # Extract db_name from URL if possible
    db_name = os.environ.get("DB_NAME")
    if not db_name:
        try:
            # Simple extraction from mongodb+srv://.../dbname?options
            path_part = mongo_url.split('/')[-1]
            db_name = path_part.split('?')[0]
        except:
            db_name = "gruvora"
    
    if not db_name or db_name == "":
        db_name = "gruvora"

    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    logger.info(f"Starting production migration on database: {db_name}")

    # 1. Normalize Roles
    role_map = {
        "Property Owner": "property_owner",
        "Stay Owner": "stay_owner",
        "Service Provider": "service_provider",
        "Hotel Owner": "hotel_owner",
        "Event Owner": "event_owner"
    }
    
    for old, new in role_map.items():
        res = await db.users.update_many({"role": old}, {"$set": {"role": new}})
        if res.modified_count > 0:
            logger.info(f"Normalized {res.modified_count} users: '{old}' -> '{new}'")

    # 2. Initialize Subscriptions & Trials
    now = datetime.now(timezone.utc)
    owner_roles = ["property_owner", "stay_owner", "service_provider", "hotel_owner", "event_owner"]
    
    owners = db.users.find({
        "role": {"$in": owner_roles},
        "$or": [
            {"subscription_status": {"$exists": False}},
            {"subscription_status": None},
            {"subscription_status": ""}
        ]
    })

    count = 0
    async for owner in owners:
        user_id = owner.get("id")
        role = owner.get("role")
        join_date_str = owner.get("created_at")
        
        try:
            join_date = datetime.fromisoformat(join_date_str.replace('Z', '+00:00')) if join_date_str else now
        except:
            join_date = now
            
        trial_end = _add_months(join_date, 5)
        
        if trial_end <= now:
            status = "expired"
            remaining = 0
        else:
            status = "trial"
            remaining = max(0, (trial_end - now).days // 30)

        sub_doc = {
            "subscription_model": "subscription",
            "subscription_status": status,
            "trial_months_remaining": remaining,
            "trial_end_date": trial_end.isoformat(),
            "next_billing_date": trial_end.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat(),
            "auto_renew": True,
            "coupon_used": "GRUVORA5",
            "subscription_amount_paise": SUBSCRIPTION_AMOUNT_PAISE,
        }

        if role in ["stay_owner", "hotel_owner", "event_owner"]:
            sub_doc["subscription_model"] = "hybrid"
            sub_doc["commission_rate"] = COMMISSION_RATE

        await db.users.update_one({"id": user_id}, {"$set": sub_doc})
        count += 1
        logger.info(f"Initialized {status} for {owner.get('email')} (Joined: {join_date.date()})")

    # 3. Reactivate Listings for Active/Trial Owners
    res = await db.listings.update_many(
        {"status": "awaiting_payment"}, 
        {"$set": {"status": "approved"}}
    )
    logger.info(f"Reactivated {res.modified_count} listings from 'awaiting_payment' to 'approved'")

    logger.info(f"Migration finished. Total owners fixed: {count}")

if __name__ == "__main__":
    asyncio.run(run_migration())
