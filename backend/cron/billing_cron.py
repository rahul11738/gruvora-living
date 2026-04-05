"""Daily billing cron for subscription expiry, overdue blocking, and reminders."""

from __future__ import annotations

import asyncio
import logging
import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from motor.motor_asyncio import AsyncIOMotorClient

logger = logging.getLogger(__name__)

SUBSCRIPTION_ROLES = {"stay_owner", "service_provider", "event_owner"}
BLOCK_DURATION_DAYS = 7
BILLING_GRACE_DAYS = 5
SUBSCRIPTION_AMOUNT_PAISE = 25100

_scheduler_task: Optional[asyncio.Task] = None


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _first_day_of_current_month(now: datetime) -> datetime:
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


async def run_billing_cycle() -> None:
    mongo_url = os.environ["MONGO_URL"]
    db_name = os.environ["DB_NAME"]
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    now = _utc_now()
    logger.info("Billing cron started at %s", now.isoformat())

    try:
        await _expire_trials(db, now)
        await _block_overdue(db, now)
        await _send_reminders(db, now)
    finally:
        client.close()
        logger.info("Billing cron finished")


async def _expire_trials(db, now: datetime) -> None:
    expired_users = await db.users.find(
        {
            "role": {"$in": list(SUBSCRIPTION_ROLES)},
            "subscription_status": "trial",
            "trial_end_date": {"$lte": now.isoformat()},
        },
        {"_id": 0, "id": 1, "name": 1},
    ).to_list(5000)

    if not expired_users:
        return

    await db.users.update_many(
        {
            "id": {"$in": [user["id"] for user in expired_users]},
        },
        {
            "$set": {
                "subscription_status": "expired",
                "trial_months_remaining": 0,
                "next_billing_date": _first_day_of_current_month(now).isoformat(),
            }
        },
    )

    notifications = [
        {
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "type": "subscription_expired",
            "title": "Free trial ended",
            "message": "Your free trial has ended. Subscribe now to continue using owner features.",
            "read": False,
            "created_at": now.isoformat(),
        }
        for user in expired_users
    ]
    await db.notifications.insert_many(notifications)
    logger.info("Expired %s trial users", len(expired_users))


async def _block_overdue(db, now: datetime) -> None:
    if now.day <= BILLING_GRACE_DAYS:
        return

    grace_cutoff = _first_day_of_current_month(now).isoformat()
    block_until = (now + timedelta(days=BLOCK_DURATION_DAYS)).isoformat()

    overdue_users = await db.users.find(
        {
            "role": {"$in": list(SUBSCRIPTION_ROLES)},
            "subscription_status": {"$in": ["expired", "pending"]},
            "next_billing_date": {"$lte": grace_cutoff},
            "block_status": {"$ne": "subscription_overdue"},
        },
        {"_id": 0, "id": 1},
    ).to_list(5000)

    if not overdue_users:
        return

    await db.users.update_many(
        {"id": {"$in": [user["id"] for user in overdue_users]}},
        {
            "$set": {
                "subscription_status": "blocked",
                "block_status": "subscription_overdue",
                "block_until": block_until,
            }
        },
    )

    notifications = [
        {
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "type": "subscription_blocked",
            "title": "Account suspended",
            "message": "Your account has been suspended for 7 days due to unpaid subscription. Pay now to restore access.",
            "read": False,
            "created_at": now.isoformat(),
        }
        for user in overdue_users
    ]
    await db.notifications.insert_many(notifications)
    logger.info("Blocked %s overdue users", len(overdue_users))


async def _send_reminders(db, now: datetime) -> None:
    if now.day != 27:
        return

    users = await db.users.find(
        {
            "role": {"$in": list(SUBSCRIPTION_ROLES)},
            "subscription_status": {"$in": ["active", "trial"]},
        },
        {"_id": 0, "id": 1},
    ).to_list(10000)

    if not users:
        return

    notifications = [
        {
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "type": "billing_reminder",
            "title": "Subscription due in 3 days",
            "message": "Your monthly subscription is due on the 1st. Pay between the 1st and 5th to avoid suspension.",
            "read": False,
            "created_at": now.isoformat(),
        }
        for user in users
    ]
    await db.notifications.insert_many(notifications)
    logger.info("Sent billing reminders to %s users", len(users))


async def _billing_loop() -> None:
    while True:
        now = _utc_now()
        next_run = now.replace(hour=0, minute=1, second=0, microsecond=0)
        if next_run <= now:
            next_run = (now + timedelta(days=1)).replace(hour=0, minute=1, second=0, microsecond=0)
        sleep_seconds = max(1.0, (next_run - now).total_seconds())
        await asyncio.sleep(sleep_seconds)
        try:
            await run_billing_cycle()
        except Exception as exc:  # pragma: no cover - cron safety net
            logger.exception("Billing cron failed: %s", exc)


def setup_billing_scheduler() -> asyncio.Task:
    global _scheduler_task
    if _scheduler_task and not _scheduler_task.done():
        return _scheduler_task
    _scheduler_task = asyncio.create_task(_billing_loop())
    return _scheduler_task
