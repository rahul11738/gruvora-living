import os
import sys
from typing import Any, Dict, List

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import server  # noqa: E402


class _FakeCursor:
    def __init__(self, docs: List[Dict[str, Any]]):
        self._docs = docs

    def sort(self, *args, **kwargs):
        return self

    def skip(self, *args, **kwargs):
        return self

    def limit(self, *args, **kwargs):
        return self

    async def to_list(self, *args, **kwargs):
        return list(self._docs)


class _FakeListingsCollection:
    def __init__(self):
        self.queries: List[Dict[str, Any]] = []

    def find(self, query, projection=None):
        self.queries.append(query)
        return _FakeCursor([])

    async def count_documents(self, query):
        return 0


class _FakeUsersCollection:
    def __init__(self):
        self.updates: List[Dict[str, Any]] = []

    async def update_one(self, query, update):
        self.updates.append({"query": query, "update": update})
        return None


class _FakeSearchHistoryCollection:
    def __init__(self):
        self.inserted: List[Dict[str, Any]] = []

    async def insert_one(self, document):
        self.inserted.append(document)
        return None


class _FakeInteractionsCollection:
    def __init__(self):
        self.inserted: List[Dict[str, Any]] = []

    async def insert_one(self, document):
        self.inserted.append(document)
        return None


class _FakeDb:
    def __init__(self):
        self.listings = _FakeListingsCollection()
        self.users = _FakeUsersCollection()
        self.search_history = _FakeSearchHistoryCollection()
        self.interactions = _FakeInteractionsCollection()


@pytest.mark.anyio
async def test_search_smart_endpoint_forwards_query(monkeypatch):
    captured = {}

    async def _fake_smart(db, query, city=None, category=None, limit=20, max_candidates=300):
        captured.update(
            {
                "query": query,
                "city": city,
                "category": category,
                "limit": limit,
                "max_candidates": max_candidates,
            }
        )
        return {"listings": [], "total": 0, "normalized_query": query, "detected_language": "en"}

    monkeypatch.setattr(server, "smart_search_listings", _fake_smart)

    result = await server.smart_search(query="ghar surat", city="surat", category="home", limit=15)

    assert result["total"] == 0
    assert captured["query"] == "ghar surat"
    assert captured["city"] == "surat"
    assert captured["category"] == "home"
    assert captured["limit"] == 15


@pytest.mark.anyio
async def test_search_suggest_endpoint_forwards_query(monkeypatch):
    captured = {}

    async def _fake_suggest(db, query, city=None, category=None, limit=8):
        captured.update({"query": query, "city": city, "category": category, "limit": limit})
        return {"query": query, "normalized_query": query, "suggestions": ["2 bhk apartment"]}

    monkeypatch.setattr(server, "suggest_search_terms", _fake_suggest)

    result = await server.search_suggestions(query="aprtment", city="surat", category="home", limit=6)

    assert result["suggestions"] == ["2 bhk apartment"]
    assert captured == {"query": "aprtment", "city": "surat", "category": "home", "limit": 6}


@pytest.mark.anyio
async def test_voice_search_uses_smart_pipeline_and_persists_history(monkeypatch):
    fake_db = _FakeDb()

    async def _fake_smart(db, query, city=None, category=None, limit=10, max_candidates=300):
        assert query == "ઘર સુરત"
        return {
            "normalized_query": "house surat",
            "detected_language": "gu",
            "detected_category": "home",
            "did_you_mean": "house surat",
            "listings": [{"id": "x1", "title": "2 BHK Apartment"}],
            "total": 1,
        }

    def _fake_normalize(query):
        return {
            "normalized_tokens": ["house", "surat"],
            "detected_category": "home",
        }

    monkeypatch.setattr(server, "db", fake_db)
    monkeypatch.setattr(server, "smart_search_listings", _fake_smart)
    monkeypatch.setattr(server, "normalize_search_query", _fake_normalize)

    result = await server.voice_search(query="ઘર સુરત", user={"id": "u-1"})

    assert result["normalized_query"] == "house surat"
    assert result["detected_language"] == "gu"
    assert result["parsed"]["location"] == "surat"
    assert result["total"] == 1
    assert fake_db.users.updates, "search history should be recorded"


@pytest.mark.anyio
async def test_get_listings_supports_q_alias_and_multilingual_or(monkeypatch):
    fake_db = _FakeDb()

    monkeypatch.setattr(server, "db", fake_db)
    monkeypatch.setattr(
        server,
        "normalize_search_query",
        lambda query: {
            "expanded_terms": ["house", "ઘર", "घर"],
            "normalized_query": "house",
        },
    )

    result = await server.get_listings(q="ghar", limit=20)

    assert result["listings"] == []
    assert result["total"] == 0
    assert fake_db.listings.queries, "expected find() calls"

    first_query = fake_db.listings.queries[0]
    if "$and" in first_query:
        clause = first_query["$and"][0]
    else:
        clause = first_query

    assert "$or" in clause
    fields = [list(cond.keys())[0] for cond in clause["$or"]]
    assert "title" in fields
    assert "title_en" in fields
    assert "description" in fields
    assert "location" in fields
    assert "city" in fields
    assert "sub_category" in fields
