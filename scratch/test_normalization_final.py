import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from pathlib import Path
from enum import Enum

class SubscriptionPlan(str, Enum):
    BASIC = "basic"
    PRO = "pro"
    ADVANCED = "advanced"
    UNLIMITED = "unlimited"

async def test_normalization_logic():
    # Test cases
    test_plans = ["unlimited", "BASIC", "pro ", "unknown"]
    
    for plan in test_plans:
        # Simulated Backend Logic (from server.py)
        plan_lower = plan.strip().lower()
        try:
            current_plan = SubscriptionPlan(plan_lower)
            # Map legacy plans to frontend-supported IDs
            if current_plan == SubscriptionPlan.UNLIMITED:
                normalized_plan = SubscriptionPlan.ADVANCED.value
            else:
                normalized_plan = current_plan.value
        except ValueError:
            normalized_plan = SubscriptionPlan.BASIC.value
            
        print(f"Input: '{plan}' -> Normalized: '{normalized_plan}'")

if __name__ == "__main__":
    asyncio.run(test_normalization_logic())
