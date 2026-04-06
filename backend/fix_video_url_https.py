import asyncio
import os
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')


async def main() -> None:
    mongo_url = os.environ.get('MONGO_URL')
    db_name = os.environ.get('DB_NAME')

    if not mongo_url or not db_name:
        raise RuntimeError('Missing MONGO_URL or DB_NAME in backend/.env')

    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    try:
        result = await db.listings.update_many(
            {},
            [
                {
                    '$set': {
                        'video_url': {
                            '$replaceOne': {
                                'input': '$video_url',
                                'find': 'http://',
                                'replacement': 'https://',
                            }
                        }
                    }
                }
            ],
        )

        print(f'matched_count={result.matched_count}')
        print(f'modified_count={result.modified_count}')
    finally:
        client.close()


if __name__ == '__main__':
    asyncio.run(main())
