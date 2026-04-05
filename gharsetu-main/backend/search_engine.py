import re
import time
from difflib import SequenceMatcher, get_close_matches
from typing import Any, Dict, List, Optional, Tuple

from listing_priority import listing_boost_score, listing_freshness_score

# ─────────────────────────────────────────────
# In-process query cache (45 s TTL)
# ─────────────────────────────────────────────
_CACHE_TTL_SECONDS = 45
_search_cache: Dict[str, Tuple[float, Dict[str, Any]]] = {}

_SEARCH_FIELDS = [
    "title", "title_en", "title_gu", "title_hi",
    "description", "location", "city", "sub_category", "category",
]

# ─────────────────────────────────────────────
# Translation / synonym tables
# ─────────────────────────────────────────────
_TRANSLATION_MAP = {
    "ghar": "house", "makaan": "house", "makan": "house",
    "flat": "apartment", "aprtment": "apartment",
    "home": "house", "house": "house", "villa": "villa",
    "dukan": "shop", "dukkan": "shop",
    "office": "office", "hotel": "hotel",
    "plumber": "plumber", "electrician": "electrician",
    "paintar": "painter",
    "surat": "surat", "ahmedabad": "ahmedabad", "vadodara": "vadodara",
    "rajkot": "rajkot", "gandhinagar": "gandhinagar",
    "gharno": "house", "gharni": "house", "room": "room",
    "2bhk": "2 bhk", "3bhk": "3 bhk",
    # Gujarati
    "ઘર": "house", "મકાન": "house", "ફ્લેટ": "apartment",
    "અપાર્ટમેન્ટ": "apartment", "દુકાન": "shop", "ઓફિસ": "office",
    "હોટેલ": "hotel", "રૂમ": "room", "પ્લમ્બર": "plumber",
    "ઇલેક્ટ્રિશિયન": "electrician", "સુરત": "surat",
    "અમદાવાદ": "ahmedabad", "વડોદરા": "vadodara",
    "રાજકોટ": "rajkot", "ગાંધીનગર": "gandhinagar",
    "ભાડે": "rent", "વેચાણ": "sell",
    # Hindi
    "घर": "house", "मकान": "house", "फ्लैट": "apartment",
    "अपार्टमेंट": "apartment", "दुकान": "shop", "ऑफिस": "office",
    "होटल": "hotel", "कमरा": "room", "प्लंबर": "plumber",
    "इलेक्ट्रीशियन": "electrician", "सूरत": "surat",
    "अहमदाबाद": "ahmedabad", "वडोदरा": "vadodara",
    "राजकोट": "rajkot", "गांधीनगर": "gandhinagar",
    "किराये": "rent", "किराया": "rent", "बिक्री": "sell",
}

_SYNONYMS = {
    "house": {"house", "home", "ghar", "makaan", "makan", "ઘર", "મકાન", "घर", "मकान"},
    "apartment": {"apartment", "flat", "unit", "ફ્લેટ", "ફલેટ", "फ्लैट", "अपार्टमेंट"},
    "shop": {"shop", "store", "dukkan", "dukan", "દુકાન", "दुकान"},
    "office": {"office", "workspace", "coworking", "ઓફિસ", "ऑफिस"},
    "hotel": {"hotel", "stay", "guesthouse", "હોટેલ", "होटल"},
    "room": {"room", "pg", "hostel", "રૂમ", "कमरा"},
    "rent": {"rent", "rental", "lease", "ભાડે", "किराया", "किराये"},
    "sell": {"sell", "sale", "buy", "વેચાણ", "बिक्री"},
    "plumber": {"plumber", "pipe", "પ્લમ્બર", "प्लंबर"},
    "electrician": {"electrician", "wiring", "ઇલેક્ટ્રિશિયન", "इलेक्ट्रीशियन"},
    "surat": {"surat", "સુરત", "सूरत"},
    "ahmedabad": {"ahmedabad", "અમદાવાદ", "अहमदाबाद"},
    "vadodara": {"vadodara", "વડોદરા", "वडोदरा"},
    "rajkot": {"rajkot", "રાજકોટ", "राजकोट"},
    "gandhinagar": {"gandhinagar", "ગાંધીનગર", "गांधीनगर"},
}

_TERM_TO_CANONICAL: Dict[str, str] = {
    term: canonical
    for canonical, terms in _SYNONYMS.items()
    for term in terms
}

_VOICE_STOP_WORDS = {
    "a", "an", "and", "for", "find", "show", "me", "please",
    "near", "nearby", "the", "to", "at", "in", "of", "on",
    "with", "looking", "search", "need", "want", "get", "into",
}

_CATEGORY_HINTS = {
    "home": {
        "house", "apartment", "villa", "flat", "pg", "hostel",
        "rowhouse", "row", "duplex", "bungalow", "penthouse",
        "farmhouse", "bhk", "residential", "plot",
    },
    "business": {"shop", "office", "warehouse", "showroom", "godown", "commercial"},
    "stay": {"hotel", "room", "guesthouse", "resort", "homestay", "stay"},
    "event": {"party", "marriage", "banquet", "venue", "wedding", "event"},
    "services": {
        "plumber", "electrician", "painter", "cleaner", "repair",
        "carpenter", "pest", "cctv", "painting", "cleaning",
    },
}

# Words that should NEVER be treated as property nouns
_GENERIC_WORDS = set(_VOICE_STOP_WORDS) | {
    "hotel", "flat", "house", "office", "shop", "room", "pg",
    "stay", "resort", "villa", "apartment", "bungalow",
    "plumber", "electrician", "painter", "cleaner",
}

_CITY_NAMES = {
    "surat", "ahmedabad", "vadodara", "rajkot", "gandhinagar",
    "bharuch", "anand", "nadiad", "jamnagar", "bhavnagar",
}

# ─────────────────────────────────────────────
# Tokenisation helpers
# ─────────────────────────────────────────────
def _tokenize(text: str) -> List[str]:
    if not text:
        return []
    return re.findall(r"[a-z0-9]+|[\u0900-\u097f]+|[\u0a80-\u0aff]+", text.lower())


def _normalize_token(token: str) -> str:
    mapped = _TRANSLATION_MAP.get(token, token)
    return _TERM_TO_CANONICAL.get(mapped, mapped)


def _normalize_text(text: str) -> str:
    return " ".join(_normalize_token(t) for t in _tokenize(text))


def _listing_title_text(listing: Dict[str, Any]) -> str:
    parts = [
        str(listing.get("title") or ""),
        str(listing.get("title_en") or ""),
        str(listing.get("title_gu") or ""),
        str(listing.get("title_hi") or ""),
    ]
    return " ".join(p for p in parts if p).strip()


# ─────────────────────────────────────────────
# Proper-noun extractor
# Extract words that are NOT generic property terms / cities / stop-words.
# These are likely business/property names (e.g. "Rahul Raj", "Vadhushala").
# ─────────────────────────────────────────────
def _extract_proper_nouns(raw_query: str) -> str:
    tokens = raw_query.lower().split()
    proper = []
    for tok in tokens:
        clean = re.sub(r"[^a-z0-9\u0a80-\u0aff\u0900-\u097f]", "", tok)
        if not clean:
            continue
        normalized = _normalize_token(clean)
        if normalized in _GENERIC_WORDS or clean in _CITY_NAMES or clean in _VOICE_STOP_WORDS:
            continue
        # Skip pure numbers
        if clean.isdigit():
            continue
        proper.append(clean)
    return " ".join(proper)


# ─────────────────────────────────────────────
# Public: normalize_search_query
# ─────────────────────────────────────────────
def normalize_search_query(query: str) -> Dict[str, Any]:
    raw_tokens = _tokenize(query)
    norm_tokens: List[str] = []
    expanded_terms: List[str] = []

    for token in raw_tokens:
        normalized = _normalize_token(token)
        if not normalized or normalized in _VOICE_STOP_WORDS:
            continue
        norm_tokens.append(normalized)
        if normalized in _SYNONYMS:
            expanded_terms.extend(_SYNONYMS[normalized])
        else:
            expanded_terms.append(normalized)

    seen: set = set()
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


# ─────────────────────────────────────────────
# Cache helpers
# ─────────────────────────────────────────────
def _cache_key(query: str, city: Optional[str], category: Optional[str], limit: int) -> str:
    return (
        f"q={query.lower().strip()}"
        f"|city={(city or '').lower().strip()}"
        f"|cat={(category or '').lower().strip()}"
        f"|limit={limit}"
    )


def _cleanup_cache() -> None:
    now = time.time()
    for k in [k for k, (exp, _) in _search_cache.items() if exp <= now]:
        _search_cache.pop(k, None)


# ─────────────────────────────────────────────
# Core scoring function
# Returns a float score for a listing given query signals.
# Priority order (highest → lowest):
#   1. Exact proper-noun match in title            (+100)
#   2. Partial proper-noun match in title          (+60)
#   3. Full normalized query in title              (+45)
#   4. Query tokens overlap in title               (+8 each)
#   5. Expanded synonyms in any field              (+12 each)
#   6. Popularity (views / likes)                  (+up to 5)
# ─────────────────────────────────────────────
def _score_listing(
    listing: Dict[str, Any],
    proper_noun_query: str,
    normalized_query: str,
    query_tokens: List[str],
    expanded_terms: List[str],
) -> float:
    haystack = " ".join(str(listing.get(f, "")) for f in _SEARCH_FIELDS)
    norm_haystack = _normalize_text(haystack)
    hay_tokens = set(_tokenize(norm_haystack))

    title_text = _listing_title_text(listing)
    norm_title = _normalize_text(title_text)
    title_lower = title_text.lower()
    title_tokens = set(_tokenize(norm_title))

    score = 0.0

    # ── Tier 1: Proper-noun exact/partial match in title ──
    if proper_noun_query:
        if proper_noun_query in title_lower:
            score += 100                          # Exact proper-noun in title → highest priority
        elif all(w in title_lower for w in proper_noun_query.split()):
            score += 75                           # All words present (any order)
        else:
            words = proper_noun_query.split()
            overlap = sum(1 for w in words if w in title_lower)
            if overlap:
                score += (overlap / len(words)) * 40   # Partial match

    # ── Tier 2: Full normalized query in title ──
    if normalized_query and normalized_query in norm_title:
        score += 45
    if normalized_query and normalized_query in norm_haystack:
        score += 20
    if normalized_query and norm_title.startswith(normalized_query):
        score += 15

    # ── Tier 3: Token-level overlap in title ──
    if query_tokens:
        title_overlap = sum(1 for token in query_tokens if token in title_tokens)
        if title_overlap:
            score += title_overlap * 8
        if title_overlap == len(query_tokens):
            score += 20

    # ── Tier 4: Expanded synonym match in any field ──
    for term in expanded_terms[:20]:
        canonical = _normalize_token(term)
        if canonical in hay_tokens:
            score += 12
        elif any(tok.startswith(canonical) for tok in hay_tokens):
            score += 6
        else:
            subset = list(hay_tokens)[:80]
            if subset:
                best = max(SequenceMatcher(None, canonical, tok).ratio() for tok in subset)
                if best >= 0.86:
                    score += best * 4

    # ── Tier 5: Popularity tie-breaker ──
    score += min(float(listing.get("views", 0)) / 5000.0, 3)
    score += min(float(listing.get("likes", 0)) / 1000.0, 2)
    score += listing_boost_score(listing) * 0.6
    score += listing_freshness_score(listing) * 1.1

    return score


# ─────────────────────────────────────────────
# Public: smart_search_listings
# ─────────────────────────────────────────────
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
    query_lower = query.lower()
    query_tokens = normalized.get("normalized_tokens", [])

    # ── Extract proper nouns (business names, owner names, etc.) ──
    proper_noun_query = _extract_proper_nouns(query)

    # ── Build MongoDB query ──
    db_query: Dict[str, Any] = {
        "status": {"$in": ["approved", "boosted"]},
        "is_available": True,
    }
    if city:
        db_query["city"] = {"$regex": re.escape(city), "$options": "i"}

    effective_category = category or normalized.get("detected_category")

    # Sub-category detection
    sub_category_map = {
        "rowhouse": "rowhouse", "row house": "rowhouse", "row-house": "rowhouse",
        "duplex": "duplex", "bungalow": "bungalow", "villa": "villa",
        "penthouse": "penthouse", "farmhouse": "farmhouse",
        "1bhk": "1bhk", "2bhk": "2bhk", "3bhk": "3bhk", "4bhk": "4bhk",
        "pg": "pg", "hostel": "hostel",
        "shop": "shop", "office": "office", "warehouse": "warehouse",
        "showroom": "showroom", "godown": "godown",
        "hotel": "hotel", "resort": "resort", "guesthouse": "guesthouse",
        "partyplot": "partyplot", "party plot": "partyplot",
        "marriagehall": "marriagehall", "marriage hall": "marriagehall",
        "banquethall": "banquethall", "banquet hall": "banquethall",
        "plumber": "plumber", "electrician": "electrician",
        "painter": "painting", "ac repair": "ac_repair",
        "pest control": "pest_control", "carpenter": "carpenter",
        "cleaning": "home_cleaning",
    }

    detected_sub_category = None
    detected_sub_category_pattern = None
    bhk_match = re.search(r"\b([1-9])\s*[-_]?\s*bhk\b", query_lower)
    if bhk_match:
        bhk_digit = bhk_match.group(1)
        detected_sub_category = f"{bhk_digit}bhk"
        detected_sub_category_pattern = rf"{bhk_digit}\s*[-_]?\s*bhk"

    if not detected_sub_category:
        for phrase, sub_cat in sub_category_map.items():
            if phrase in query_lower:
                detected_sub_category = sub_cat
                if sub_cat in {"1bhk", "2bhk", "3bhk", "4bhk"}:
                    detected_sub_category_pattern = rf"{sub_cat[0]}\s*[-_]?\s*bhk"
                break

    # Area detection
    area_aliases = {
        "vesu": ["vesu"], "adajan": ["adajan"], "katargam": ["katargam"],
        "varachha": ["varachha", "varacha", "nana varachha", "mota varachha"],
        "piplod": ["piplod"], "pal": ["pal"], "althan": ["althan"],
        "bhatar": ["bhatar"], "citylight": ["citylight", "city light"],
        "athwalines": ["athwalines", "athwa lines", "athwa"],
        "sarthana": ["sarthana"], "udhna": ["udhna"], "limbayat": ["limbayat"],
        "sachin": ["sachin"], "hazira": ["hazira"],
        "satellite": ["satellite"], "bopal": ["bopal"],
        "thaltej": ["thaltej"],
        "prahlad nagar": ["prahlad nagar", "prahladnagar"],
        "navrangpura": ["navrangpura"], "vastrapur": ["vastrapur"],
        "ellisbridge": ["ellisbridge", "ellis bridge"],
        "maninagar": ["maninagar"], "alkapuri": ["alkapuri"],
        "fatehgunj": ["fatehgunj", "fateh ganj"],
        "manjalpur": ["manjalpur"], "gotri": ["gotri"],
    }
    detected_area = None
    for canonical_area, aliases in area_aliases.items():
        if any(alias in query_lower for alias in aliases):
            detected_area = canonical_area
            break

    # Apply filters
    if detected_sub_category_pattern:
        db_query["sub_category"] = {"$regex": detected_sub_category_pattern, "$options": "i"}
        if effective_category:
            db_query["category"] = effective_category
    elif detected_sub_category:
        db_query["sub_category"] = {"$regex": re.escape(detected_sub_category), "$options": "i"}
        if effective_category:
            db_query["category"] = effective_category
    elif effective_category:
        db_query["category"] = effective_category

    if detected_area:
        location_pattern_map = {
            "varachha": r"varach+h?a|varacha|nana\s*varach+h?a|mota\s*varach+h?a",
            "citylight": r"city\s*light|citylight",
            "athwalines": r"athwa\s*lines?|athwalines",
            "prahlad nagar": r"prahlad\s*nagar|prahladnagar",
            "ellisbridge": r"ellis\s*bridge|ellisbridge",
            "fatehgunj": r"fateh\s*ganj|fatehgunj",
        }
        location_pattern = location_pattern_map.get(detected_area, re.escape(detected_area))
        db_query["location"] = {"$regex": location_pattern, "$options": "i"}

    # ── BUILD $or SEARCH CLAUSE ──
    # CRITICAL FIX: Use a UNION of proper-noun search + synonym search
    # so that "rahul raj" matches title directly AND "hotel" expands to synonyms.
    or_clauses = []

    # Proper-noun search: exact/substring match in ALL text fields
    if proper_noun_query:
        pn_pattern = re.escape(proper_noun_query)
        for field in _SEARCH_FIELDS:
            or_clauses.append({field: {"$regex": pn_pattern, "$options": "i"}})
        # Also search individual words of the proper noun (handles partial matches)
        for word in proper_noun_query.split():
            if len(word) >= 3:
                for field in ("title", "title_en"):
                    or_clauses.append({field: {"$regex": re.escape(word), "$options": "i"}})

    # Synonym/expanded-term search
    if expanded_terms:
        regex_pattern = "|".join(re.escape(t) for t in expanded_terms[:30])
        for field in _SEARCH_FIELDS:
            or_clauses.append({field: {"$regex": regex_pattern, "$options": "i"}})

    if or_clauses:
        db_query["$or"] = or_clauses

    projection = {
        "_id": 0, "id": 1, "title": 1, "description": 1, "location": 1,
        "city": 1, "category": 1, "sub_category": 1, "price": 1,
        "listing_type": 1, "images": 1, "views": 1, "likes": 1, "created_at": 1,
        "title_en": 1, "title_gu": 1, "title_hi": 1,
    }
    candidates = await db.listings.find(db_query, projection).limit(max_candidates).to_list(max_candidates)

    # Relaxed fallbacks
    if not candidates and (detected_sub_category or detected_sub_category_pattern):
        relaxed = dict(db_query)
        relaxed.pop("sub_category", None)
        candidates = await db.listings.find(relaxed, projection).limit(max_candidates).to_list(max_candidates)

    if not candidates and detected_area:
        relaxed = dict(db_query)
        relaxed.pop("location", None)
        candidates = await db.listings.find(relaxed, projection).limit(max_candidates).to_list(max_candidates)

    # ── Score and rank ──
    ranked: List[Tuple[float, Dict[str, Any]]] = []
    for listing in candidates:
        score = _score_listing(
            listing,
            proper_noun_query=proper_noun_query,
            normalized_query=normalized_query,
            query_tokens=query_tokens,
            expanded_terms=expanded_terms,
        )
        if score > 0 or not expanded_terms:
            listing["_score"] = round(score, 3)
            ranked.append((score, listing))

    ranked.sort(key=lambda x: x[0], reverse=True)
    top = [item[1] for item in ranked[:max(limit, 1)]]

    # ── Did-you-mean ──
    did_you_mean = ""
    if normalized["normalized_tokens"] and len(top) < max(3, min(limit, 6)):
        vocab: set = set()
        for _, lst in ranked[:80]:
            vocab.update(_tokenize(_normalize_text(" ".join(str(lst.get(f, "")) for f in _SEARCH_FIELDS))))
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
        "proper_noun_query": proper_noun_query,
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


# ─────────────────────────────────────────────
# Public: suggest_search_terms
# ─────────────────────────────────────────────
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

    suggestion_set: set = set()
    for doc in docs:
        if doc.get("title"):
            suggestion_set.add(doc["title"].strip())
        if doc.get("sub_category"):
            suggestion_set.add(str(doc["sub_category"]).strip())

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
        "suggestions": ranked[:max(limit, 1)],
    }