import os
import sys
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from search_engine import normalize_search_query, smart_search_listings


class _FakeCursor:
    def __init__(self, docs: List[Dict[str, Any]]):
        self._docs = docs

    def limit(self, *args, **kwargs):
        return self

    async def to_list(self, *args, **kwargs):
        return list(self._docs)


class _FakeListingsCollection:
    def __init__(self, docs: List[Dict[str, Any]]):
        self.docs = docs

    def find(self, query, projection=None):
        return _FakeCursor(self.docs)


class _FakeDb:
    def __init__(self, docs: List[Dict[str, Any]]):
        self.listings = _FakeListingsCollection(docs)


def test_normalize_gujarati_house_query() -> None:
    result = normalize_search_query("સુરત માં ઘર")
    assert result["detected_language"] == "gu"
    assert "surat" in result["normalized_tokens"]
    assert "house" in result["normalized_tokens"]
    assert result["normalized_query"]


def test_normalize_hindi_apartment_query() -> None:
    result = normalize_search_query("अहमदाबाद फ्लैट किराया")
    assert result["detected_language"] == "hi"
    assert "ahmedabad" in result["normalized_tokens"]
    assert "apartment" in result["normalized_tokens"]
    assert "rent" in result["normalized_tokens"]


def test_synonym_expansion_contains_multilingual_terms() -> None:
    result = normalize_search_query("ghar")
    expanded = set(result["expanded_terms"])
    assert "house" in expanded
    assert "ઘર" in expanded
    assert "घर" in expanded


def test_detects_category_from_service_keywords() -> None:
    result = normalize_search_query("મને સુરત માં ઇલેક્ટ્રિશિયન જોઈએ")
    assert result["detected_category"] == "services"


def test_typo_token_is_preserved_for_fuzzy_layer() -> None:
    result = normalize_search_query("aprtment surat")
    # Translation map should normalize common typo to apartment.
    assert "apartment" in result["normalized_tokens"]
    assert "surat" in result["normalized_tokens"]


@pytest.mark.anyio
async def test_exact_title_is_ranked_above_generic_hotel_listing() -> None:
    db = _FakeDb(
        [
            {
                "id": "generic-1",
                "title": "Hotel Vadhushala",
                "description": "Popular stay in the city",
                "city": "surat",
                "category": "stay",
                "sub_category": "hotel",
                "views": 9000,
                "likes": 500,
            },
            {
                "id": "match-1",
                "title": "The Grand Palace Hotel",
                "description": "Premium hotel stay",
                "city": "surat",
                "category": "stay",
                "sub_category": "hotel",
                "views": 10,
                "likes": 1,
            },
        ]
    )

    result = await smart_search_listings(db, "the Grand Palace Hotel", category="stay", limit=5)

    assert result["listings"][0]["id"] == "match-1"


@pytest.mark.anyio
async def test_fresh_listing_is_ranked_above_old_listing_when_text_signals_match() -> None:
    now = datetime.now(timezone.utc)

    db = _FakeDb(
        [
            {
                "id": "old-listing",
                "title": "Grand Palace Hotel",
                "description": "Premium hotel stay",
                "city": "surat",
                "category": "stay",
                "sub_category": "hotel",
                "views": 5,
                "likes": 1,
                "created_at": (now - timedelta(days=3)).isoformat(),
            },
            {
                "id": "fresh-listing",
                "title": "Grand Palace Hotel",
                "description": "Premium hotel stay",
                "city": "surat",
                "category": "stay",
                "sub_category": "hotel",
                "views": 5,
                "likes": 1,
                "created_at": (now - timedelta(hours=2)).isoformat(),
                "fresh_priority_until": (now + timedelta(hours=22)).isoformat(),
            },
        ]
    )

    result = await smart_search_listings(db, "Grand Palace Hotel", category="stay", limit=5)

    assert result["listings"][0]["id"] == "fresh-listing"
