import re
import time
from difflib import SequenceMatcher, get_close_matches
from typing import Any, Dict, List, Optional, Tuple

# Lightweight in-process cache for repeated popular queries.
_CACHE_TTL_SECONDS = 45
_search_cache: Dict[str, Tuple[float, Dict[str, Any]]] = {}

_SEARCH_FIELDS = [
    "title",
    "title_en",
    "title_gu",
    "title_hi",
    "description",
    "location",
    "city",
    "sub_category",
    "category",
]

_TRANSLATION_MAP = {
    "ghar": "house",
    "makaan": "house",
    "makan": "house",
    "flat": "apartment",
    "aprtment": "apartment",
    "home": "house",
    "house": "house",
    "villa": "villa",
    "dukan": "shop",
    "dukkan": "shop",
    "office": "office",
    "hotel": "hotel",
    "plumber": "plumber",
    "electrician": "electrician",
    "paintar": "painter",
    "surat": "surat",
    "ahmedabad": "ahmedabad",
    "vadodara": "vadodara",
    "rajkot": "rajkot",
    "gandhinagar": "gandhinagar",
    "gharno": "house",
    "gharni": "house",
    "room": "room",
    "2bhk": "2 bhk",
    "3bhk": "3 bhk",
    # Gujarati
    "ઘર": "house",
    "મકાન": "house",
    "ફ્લેટ": "apartment",
    "અપાર્ટમેન્ટ": "apartment",
    "દુકાન": "shop",
    "ઓફિસ": "office",
    "હોટેલ": "hotel",
    "રૂમ": "room",
    "પ્લમ્બર": "plumber",
    "ઇલેક્ટ્રિશિયન": "electrician",
    "સુરત": "surat",
    "અમદાવાદ": "ahmedabad",
    "વડોદરા": "vadodara",
    "રાજકોટ": "rajkot",
    "ગાંધીનગર": "gandhinagar",
    "ભાડે": "rent",
    "વેચાણ": "sell",
    # Hindi
    "घर": "house",
    "मकान": "house",
    "फ्लैट": "apartment",
    "अपार्टमेंट": "apartment",
    "दुकान": "shop",
    "ऑफिस": "office",
    "होटल": "hotel",
    "कमरा": "room",
    "प्लंबर": "plumber",
    "इलेक्ट्रीशियन": "electrician",
    "सूरत": "surat",
    "अहमदाबाद": "ahmedabad",
    "वडोदरा": "vadodara",
    "राजकोट": "rajkot",
    "गांधीनगर": "gandhinagar",
    "किराये": "rent",
    "किराया": "rent",
    "बिक्री": "sell",
}

_SYNONYMS = {
    "house": {"house", "home", "ghar", "makaan", "makan", "ઘર", "મકાન", "घर", "मकान"},
    "apartment": {"apartment", "flat", "unit", "ફ્લેટ", "ફલેટ", "फ्लैट", "अपार्टमेंट"},
    "shop": {"shop", "store", "dukkan", "dukan", "દુકાન", "दुकान"},
    "office": {"office", "workspace", "coworking", "ઓફિસ", "ऑफिस"},
    "hotel": {"hotel", "stay", "guesthouse", "હોટેલ", "होटल"},
    "room": {"room", "pg", "hostel", "રૂમ", "कमरा"},
    "rent": {"rent", "rental", "lease", "ભાડે", "કિરાયા", "किराया", "किराये"},
    "sell": {"sell", "sale", "buy", "વેચાણ", "बिक्री"},
    "plumber": {"plumber", "pipe", "પ્લમ્બર", "प्लंबर"},
    "electrician": {"electrician", "wiring", "ઇલેક્ટ્રિશિયન", "इलेक्ट्रीशियन"},
    "surat": {"surat", "સુરત", "सूरत"},
    "ahmedabad": {"ahmedabad", "અમદાવાદ", "अहमदाबाद"},
    "vadodara": {"vadodara", "વડોદરા", "वडोदरा"},
    "rajkot": {"rajkot", "રાજકોટ", "राजकोट"},
    "gandhinagar": {"gandhinagar", "ગાંધીનગર", "गांधीनगर"},
}

_TERM_TO_CANONICAL: Dict[str, str] = {}
for canonical, terms in _SYNONYMS.items():
    for term in terms:
        _TERM_TO_CANONICAL[term] = canonical

_CATEGORY_HINTS = {
    "home": {"house", "apartment", "villa", "flat", "pg", "hostel"},
    "business": {"shop", "office", "warehouse", "showroom"},
    "stay": {"hotel", "room", "guesthouse", "resort", "homestay"},
    "event": {"party", "marriage", "banquet", "venue", "wedding"},
    "services": {"plumber", "electrician", "painter", "cleaner", "repair"},
}


def _tokenize(text: str) -> List[str]:
    if not text:
        return []
    return re.findall(r"[a-z0-9]+|[\u0900-\u097f]+|[\u0a80-\u0aff]+", text.lower())


def _normalize_token(token: str) -> str:
    mapped = _TRANSLATION_MAP.get(token, token)
    return _TERM_TO_CANONICAL.get(mapped, mapped)


def normalize_search_query(query: str) -> Dict[str, Any]:
    raw_tokens = _tokenize(query)
    norm_tokens: List[str] = []
    expanded_terms: List[str] = []

    for token in raw_tokens:
        normalized = _normalize_token(token)
        if normalized:
            norm_tokens.append(normalized)
            if normalized in _SYNONYMS:
                expanded_terms.extend(_SYNONYMS[normalized])
            else:
                expanded_terms.append(normalized)

    # Keep term order stable while de-duplicating.
    seen = set()
    stable_expanded: List[str] = []
    for term in expanded_terms:
        if term and term not in seen:
            seen.add(term)
            stable_expanded.append(term)

    detected_language = "en"
    if any(re.search(r"[\u0a80-\u0aff]", t) for t in raw_tokens):
        detected_language = "gu"
    elif any(re.search(r"[\u0900-\u097f]", t) for t in raw_tokens):
        detected_language = "hi"

    detected_category = None
    term_set = set(norm_tokens)
    for category, hints in _CATEGORY_HINTS.items():
        if term_set.intersection(hints):
            detected_category = category
            break

    return {
        "raw_query": query,
        "detected_language": detected_language,
        "normalized_tokens": norm_tokens,
        "expanded_terms": stable_expanded,
        "normalized_query": " ".join(norm_tokens).strip(),
        "detected_category": detected_category,
    }


def _normalize_text(text: str) -> str:
    tokens = [_normalize_token(t) for t in _tokenize(text)]
    return " ".join(tokens)


def _cache_key(query: str, city: Optional[str], category: Optional[str], limit: int) -> str:
    return f"q={query.lower().strip()}|city={(city or '').lower().strip()}|cat={(category or '').lower().strip()}|limit={limit}"


def _cleanup_cache() -> None:
    now = time.time()
    stale = [k for k, (exp, _) in _search_cache.items() if exp <= now]
    for k in stale:
        _search_cache.pop(k, None)


async def smart_search_listings(
    db,
    query: str,
    city: Optional[str] = None,
    category: Optional[str] = None,
    limit: int = 20,
    max_candidates: int = 300,
) -> Dict[str, Any]:
    _cleanup_cache()
    key = _cache_key(query, city, category, limit)
    cached = _search_cache.get(key)
    if cached and cached[0] > time.time():
        return cached[1]

    normalized = normalize_search_query(query)
    expanded_terms = normalized["expanded_terms"]
    normalized_query = normalized["normalized_query"]

    db_query: Dict[str, Any] = {
        "status": {"$in": ["approved", "boosted"]},
        "is_available": True,
    }
    if city:
        db_query["city"] = {"$regex": re.escape(city), "$options": "i"}

    effective_category = category or normalized.get("detected_category")
    if effective_category:
        db_query["category"] = effective_category

    if expanded_terms:
        regex_pattern = "|".join(re.escape(t) for t in expanded_terms[:30])
        db_query["$or"] = [{field: {"$regex": regex_pattern, "$options": "i"}} for field in _SEARCH_FIELDS]

    projection = {
        "_id": 0,
        "id": 1,
        "title": 1,
        "description": 1,
        "location": 1,
        "city": 1,
        "category": 1,
        "sub_category": 1,
        "price": 1,
        "listing_type": 1,
        "images": 1,
        "views": 1,
        "likes": 1,
        "created_at": 1,
    }
    candidates = await db.listings.find(db_query, projection).limit(max_candidates).to_list(max_candidates)

    ranked: List[Tuple[float, Dict[str, Any]]] = []
    for listing in candidates:
        haystack = " ".join(str(listing.get(f, "")) for f in _SEARCH_FIELDS)
        norm_haystack = _normalize_text(haystack)
        hay_tokens = set(_tokenize(norm_haystack))

        score = 0.0
        if normalized_query and normalized_query in norm_haystack:
            score += 20

        for term in expanded_terms[:20]:
            canonical = _normalize_token(term)
            if canonical in hay_tokens:
                score += 12
            elif any(tok.startswith(canonical) for tok in hay_tokens):
                score += 6
            else:
                if hay_tokens:
                    best_ratio = max(SequenceMatcher(None, canonical, tok).ratio() for tok in list(hay_tokens)[:80])
                    if best_ratio >= 0.86:
                        score += best_ratio * 4

        # Mild behavioral weighting for tie-breakers.
        score += min(float(listing.get("views", 0)) / 5000.0, 3)
        score += min(float(listing.get("likes", 0)) / 1000.0, 2)

        if score > 0 or not expanded_terms:
            listing["_score"] = round(score, 3)
            ranked.append((score, listing))

    ranked.sort(key=lambda x: x[0], reverse=True)
    top = [item[1] for item in ranked[: max(limit, 1)]]

    did_you_mean = ""
    if normalized["normalized_tokens"] and len(top) < max(3, min(limit, 6)):
        vocab = set()
        for _, listing in ranked[:80]:
            vocab.update(_tokenize(_normalize_text(" ".join(str(listing.get(f, "")) for f in _SEARCH_FIELDS))))
        replacements = []
        for token in normalized["normalized_tokens"][:4]:
            if token in vocab:
                replacements.append(token)
            else:
                near = get_close_matches(token, list(vocab), n=1, cutoff=0.84)
                replacements.append(near[0] if near else token)
        alt = " ".join(replacements).strip()
        if alt and alt != normalized_query:
            did_you_mean = alt

    payload = {
        "query": query,
        "normalized_query": normalized_query or query.lower().strip(),
        "detected_language": normalized["detected_language"],
        "detected_category": effective_category,
        "city": city,
        "applied_terms": expanded_terms[:20],
        "did_you_mean": did_you_mean,
        "total": len(ranked),
        "listings": top,
    }

    _search_cache[key] = (time.time() + _CACHE_TTL_SECONDS, payload)
    return payload


async def suggest_search_terms(
    db,
    query: str,
    city: Optional[str] = None,
    category: Optional[str] = None,
    limit: int = 8,
) -> Dict[str, Any]:
    normalized = normalize_search_query(query)
    term = normalized.get("normalized_query") or query.lower().strip()
    if len(term) < 2:
        return {"query": query, "normalized_query": term, "suggestions": []}

    db_query: Dict[str, Any] = {
        "status": {"$in": ["approved", "boosted"]},
        "is_available": True,
    }
    if city:
        db_query["city"] = {"$regex": re.escape(city), "$options": "i"}
    if category:
        db_query["category"] = category

    regex = re.escape(term)
    db_query["$or"] = [
        {"title": {"$regex": regex, "$options": "i"}},
        {"sub_category": {"$regex": regex, "$options": "i"}},
        {"city": {"$regex": regex, "$options": "i"}},
        {"location": {"$regex": regex, "$options": "i"}},
    ]

    docs = await db.listings.find(
        db_query,
        {"_id": 0, "title": 1, "sub_category": 1, "city": 1, "category": 1},
    ).limit(80).to_list(80)

    suggestion_set = set()
    for doc in docs:
        if doc.get("title"):
            suggestion_set.add(doc["title"].strip())
        if doc.get("sub_category"):
            suggestion_set.add(str(doc["sub_category"]).strip())

    # Add synonym-driven suggestions for multilingual inputs.
    for tok in normalized.get("normalized_tokens", [])[:3]:
        if tok in _SYNONYMS:
            suggestion_set.update(_SYNONYMS[tok])

    ranked = sorted(
        suggestion_set,
        key=lambda s: SequenceMatcher(None, term, _normalize_text(s)).ratio(),
        reverse=True,
    )

    return {
        "query": query,
        "normalized_query": term,
        "suggestions": ranked[: max(limit, 1)],
    }
