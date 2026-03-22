import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from search_engine import normalize_search_query


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
