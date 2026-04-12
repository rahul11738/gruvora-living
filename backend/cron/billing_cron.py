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

SUBSCRIPTION_ROLES = {"property_owner", "stay_owner", "service_provider", "event_owner"}
BLOCK_DURATION_DAYS = 7
BILLING_GRACE_DAYS = 5
SUBSCRIPTION_AMOUNT_PAISE = 99900

# Days before trial end to send reminder notifications
TRIAL_REMINDER_DAYS = [30, 7, 1]

_scheduler_task: Optional[asyncio.Task] = None


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _first_day_of_current_month(now: datetime) -> datetime:
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def _parse_iso(value: str) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return None


async def run_billing_cycle() -> None:
    mongo_url = os.environ["MONGO_URL"]
    db_name = os.environ["DB_NAME"]
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    now = _utc_now()
    logger.info("Billing cron started at %s", now.isoformat())

    try:
        await _send_trial_ending_reminders(db, now)
        await _expire_trials(db, now)
        await _block_overdue(db, now)
        await _send_monthly_billing_reminders(db, now)
    finally:
        client.close()
        logger.info("Billing cron finished")


async def _send_trial_ending_reminders(db, now: datetime) -> None:
    """
    Send notifications to trial users whose trial ends in exactly
    30, 7, or 1 day(s). Uses a dedup key so we never double-send.
    """
    trial_users = await db.users.find(
        {
            "role": {"$in": list(SUBSCRIPTION_ROLES)},
            "subscription_status": "trial",
            "trial_end_date": {"$exists": True, "$ne": None},
        },
        {"_id": 0, "id": 1, "name": 1, "trial_end_date": 1},
    ).to_list(10000)

    notifications = []
    for user in trial_users:
        trial_end_dt = _parse_iso(user.get("trial_end_date", ""))
        if not trial_end_dt:
            continue

        days_left = (trial_end_dt.date() - now.date()).days

        if days_left not in TRIAL_REMINDER_DAYS:
            continue

        # Dedup: check if we already sent this reminder
        dedup_key = f"trial_reminder_{user['id']}_{days_left}d"
        already_sent = await db.notifications.find_one({"dedup_key": dedup_key})
        if already_sent:
            continue

        if days_left == 1:
            title = "⚠️ Trial ends tomorrow!"
            message = (
                "Your 5-month free trial ends tomorrow. "
                "Subscribe now to keep your listings active and avoid interruption."
            )
        elif days_left == 7:
            title = "Trial ending in 7 days"
            message = (
                f"Your free trial ends on {trial_end_dt.strftime('%d %b %Y')}. "
                "Subscribe before it ends to continue listing properties without interruption."
            )
        else:  # 30 days
            title = "Trial ending in 30 days"
            message = (
                f"Your 5-month free trial ends on {trial_end_dt.strftime('%d %b %Y')}. "
                "Plan ahead — subscribe to keep full access to all owner features."
            )

        notifications.append({
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "type": "trial_ending",
            "title": title,
            "message": message,
            "dedup_key": dedup_key,
            "read": False,
            "created_at": now.isoformat(),
            "link": "/owner/dashboard?tab=subscription",
        })

    if notifications:
        await db.notifications.insert_many(notifications)
        logger.info("Sent trial-ending reminders to %s users", len(notifications))


async def _expire_trials(db, now: datetime) -> None:
    """Move trial users whose trial_end_date has passed to 'expired'."""
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
        {"id": {"$in": [u["id"] for u in expired_users]}},
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
            "user_id": u["id"],
            "type": "trial_expired",
            "title": "Free trial ended",
            "message": (
                "Your 5-month free trial has ended. "
                "Subscribe now (₹999/month) to continue listing properties and accessing owner features."
            ),
            "read": False,
            "created_at": now.isoformat(),
            "link": "/owner/dashboard?tab=subscription",
        }
        for u in expired_users
    ]
    await db.notifications.insert_many(notifications)
    logger.info("Expired %s trial users", len(expired_users))


async def _block_overdue(db, now: datetime) -> None:
    """Block users who haven't paid within the grace period after trial/expiry."""
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
        {"id": {"$in": [u["id"] for u in overdue_users]}},
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
            "user_id": u["id"],
            "type": "subscription_blocked",
            "title": "Account suspended",
            "message": (
                "Your account has been suspended due to unpaid subscription. "
                "Pay now to restore access immediately."
            ),
            "read": False,
            "created_at": now.isoformat(),
            "link": "/owner/dashboard?tab=subscription",
        }
        for u in overdue_users
    ]
    await db.notifications.insert_many(notifications)
    logger.info("Blocked %s overdue users", len(overdue_users))


async def _send_monthly_billing_reminders(db, now: datetime) -> None:
    """On the 27th of each month, remind active/trial users that billing is coming."""
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
            "user_id": u["id"],
            "type": "billing_reminder",
            "title": "Subscription due in 3 days",
            "message": (
                "Your monthly subscription renews on the 1st. "
                "Pay between the 1st and 5th to avoid suspension."
            ),
            "read": False,
            "created_at": now.isoformat(),
            "link": "/owner/dashboard?tab=subscription",
        }
        for u in users
    ]
    await db.notifications.insert_many(notifications)
    logger.info("Sent monthly billing reminders to %s users", len(users))


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
        except Exception as exc:  # pragma: no cover
            logger.exception("Billing cron failed: %s", exc)


def setup_billing_scheduler() -> asyncio.Task:
    global _scheduler_task
    if _scheduler_task and not _scheduler_task.done():
        return _scheduler_task
    _scheduler_task = asyncio.create_task(_billing_loop())
    return _scheduler_task
