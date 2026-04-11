#!/usr/bin/env python3
"""
One-time MongoDB migration script to normalize role values.

This script fixes all existing users who have old role formats like:
- "Property Owner" -> "property_owner"
- "Stay Owner" -> "stay_owner"
- "Hotel Owner" -> "hotel_owner"
- "Service Provider" -> "service_provider"
- "Event Owner" -> "event_owner"

Run this script once after deploying the backend fix to ensure all existing
users are updated in the database.

Usage:
    python migrate_roles.py

Or via mongosh:
    mongosh $MONGO_URL --eval 'db.getSiblingDB("$DB_NAME").users.updateMany({"role": "Property Owner"}, {"$set": {"role": "property_owner"}});'
"""

import asyncio
import os
import sys
from motor.motor_asyncio import AsyncIOMotorClient


ROLE_MAPPING = {
    "Property Owner": "property_owner",
    "Stay Owner": "stay_owner",
    "Hotel Owner": "hotel_owner",
    "Service Provider": "service_provider",
    "Event Owner": "event_owner",
}


async def migrate_roles():
    """Migrate all users with old role formats to normalized formats."""
    mongo_url = os.getenv("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.getenv("DB_NAME", "gruvora")

    print(f"Connecting to MongoDB at {mongo_url}...")
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    results = {"total_updated": 0, "by_role": {}}

    for old_role, new_role in ROLE_MAPPING.items():
        result = await db.users.update_many(
            {"role": old_role},
            {"$set": {"role": new_role}}
        )
        updated_count = result.modified_count
        results["by_role"][old_role] = updated_count
        results["total_updated"] += updated_count
        print(f"  {old_role} -> {new_role}: {updated_count} users updated")

    print(f"\nMigration complete! Total users updated: {results['total_updated']}")

    # Verify the migration
    print("\nVerification - role distribution after migration:")
    pipeline = [{"$group": {"_id": "$role", "count": {"$sum": 1}}}]
    async for doc in db.users.aggregate(pipeline):
        print(f"  {doc['_id']}: {doc['count']} users")

    client.close()
    return results


if __name__ == "__main__":
    asyncio.run(migrate_roles())
