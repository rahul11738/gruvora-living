"""
Performance Benchmarking Script for MongoDB Optimization
Measures latency of key endpoints before/after index deployment
"""

import asyncio
import time
from motor.motor_asyncio import AsyncIOMotorClient
import os
from typing import Dict, List
import statistics

# ============================================================================
# CONFIGURATION
# ============================================================================

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "gharsetu")

# Key endpoints to benchmark
BENCHMARK_QUERIES = {
    "listings_main_feed": {
        "collection": "listings",
        "filter": {"status": {"$in": ["approved", "boosted"]}, "is_available": True},
        "sort": [("created_at", -1)],
        "projection": {"_id": 0, "id": 1, "title": 1, "price": 1, "location": 1, "owner_id": 1, "created_at": 1},
        "limit": 20,
        "description": "Main listings feed (most critical)"
    },
    "videos_feed": {
        "collection": "videos",
        "filter": {"status": {"$in": ["approved", "public"]}, "is_available": True},
        "sort": [("created_at", -1)],
        "projection": {"_id": 0, "id": 1, "title": 1, "location": 1, "owner_id": 1, "created_at": 1, "view_count": 1},
        "limit": 20,
        "description": "Videos/reels feed"
    },
    "listings_with_filters": {
        "collection": "listings",
        "filter": {
            "status": "approved",
            "category": "homestay",
            "price": {"$gte": 1000, "$lte": 5000},
            "is_available": True
        },
        "sort": [("created_at", -1)],
        "projection": {"_id": 0, "id": 1, "title": 1, "price": 1, "location": 1},
        "limit": 50,
        "description": "Filtered listings search"
    },
    "owner_listings": {
        "collection": "listings",
        "filter": {"owner_id": "sample_owner_id", "status": "approved"},
        "sort": [("created_at", -1)],
        "projection": {"_id": 0, "id": 1, "title": 1, "price": 1, "status": 1},
        "limit": 20,
        "description": "Owner dashboard listings"
    }
}

# ============================================================================
# PERFORMANCE MEASUREMENT
# ============================================================================

async def run_query(db, query_config: Dict) -> tuple:
    """Run a single query and return execution time and document count"""
    collection = db[query_config["collection"]]
    
    start_time = time.perf_counter()
    
    # Build and execute query
    cursor = collection.find(query_config["filter"], query_config["projection"])
    cursor = cursor.sort(query_config["sort"])
    cursor = cursor.limit(query_config["limit"])
    results = await cursor.to_list(query_config["limit"])
    
    elapsed_ms = (time.perf_counter() - start_time) * 1000
    
    return elapsed_ms, len(results)


async def get_explain_stats(db, query_config: Dict) -> Dict:
    """Get explain(executionStats) for a query"""
    collection = db[query_config["collection"]]
    
    # Run explain
    explain_result = await collection.find(
        query_config["filter"], 
        query_config["projection"]
    ).sort(query_config["sort"]).limit(query_config["limit"]).explain()
    
    stats = explain_result.get("executionStats", {})
    plan = explain_result.get("queryPlanner", {})
    
    return {
        "stage": plan.get("winningPlan", {}).get("stage", "UNKNOWN"),
        "n_returned": stats.get("nReturned", 0),
        "total_docs_examined": stats.get("totalDocsExamined", 0),
        "total_keys_examined": stats.get("totalKeysExamined", 0),
        "execution_millis": stats.get("executionStats", {}).get("executionStages", {}).get("executionTimeMillis", 0),
    }


async def benchmark_query(db, query_name: str, query_config: Dict, iterations: int = 5) -> Dict:
    """Run benchmark for a single query"""
    print(f"\n{'='*80}")
    print(f"📊 BENCHMARK: {query_name}")
    print(f"   Description: {query_config['description']}")
    print(f"   Collection: {query_config['collection']}")
    print(f"   Filter: {query_config['filter']}")
    print(f"   Iterations: {iterations}")
    print(f"{'='*80}")
    
    times = []
    doc_counts = []
    
    # Warm-up run
    await run_query(db, query_config)
    
    # Benchmark runs
    for i in range(iterations):
        elapsed_ms, doc_count = await run_query(db, query_config)
        times.append(elapsed_ms)
        doc_counts.append(doc_count)
        print(f"   Run {i+1}: {elapsed_ms:.2f}ms ({doc_count} docs)")
    
    # Get query plan stats
    try:
        explain_stats = await get_explain_stats(db, query_config)
        plan_stage = explain_stats["stage"]
        docs_examined = explain_stats["total_docs_examined"]
        n_returned = explain_stats["n_returned"]
        ratio = (docs_examined / max(1, n_returned)) if n_returned else docs_examined
        
        print(f"\n   Query Plan Analysis:")
        print(f"   - Winning Stage: {plan_stage}")
        print(f"   - Docs Examined: {docs_examined}")
        print(f"   - Docs Returned: {n_returned}")
        print(f"   - Docs/Result Ratio: {ratio:.2f}x")
        
        if plan_stage == "COLLSCAN":
            print(f"   ⚠️  WARNING: Full collection scan detected! Indexes may be missing.")
        elif ratio > 50:
            print(f"   ⚠️  WARNING: High docs_examined ratio. Index optimization needed.")
        elif ratio > 10:
            print(f"   ⚡ CAUTION: Moderate efficiency. Consider index improvements.")
        else:
            print(f"   ✅ Good: Efficient query execution")
    except Exception as e:
        print(f"   ⚠️  Could not get explain stats: {e}")
    
    # Calculate statistics
    avg_time = statistics.mean(times)
    min_time = min(times)
    max_time = max(times)
    p95_time = sorted(times)[int(len(times) * 0.95)] if len(times) > 1 else avg_time
    
    print(f"\n   📈 Statistics:")
    print(f"   - Average: {avg_time:.2f}ms")
    print(f"   - Min: {min_time:.2f}ms")
    print(f"   - Max: {max_time:.2f}ms")
    print(f"   - P95: {p95_time:.2f}ms")
    
    return {
        "query_name": query_name,
        "average_ms": avg_time,
        "min_ms": min_time,
        "max_ms": max_time,
        "p95_ms": p95_time,
        "plan_stage": plan_stage if 'explain_stats' in locals() else "UNKNOWN",
        "docs_examined": docs_examined if 'explain_stats' in locals() else None,
        "ratio": ratio if 'explain_stats' in locals() else None,
    }


async def run_all_benchmarks(iterations: int = 5) -> List[Dict]:
    """Run all benchmarks"""
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    results = []
    
    try:
        print(f"\n\n{'#'*80}")
        print(f"# MONGODB PERFORMANCE BENCHMARK")
        print(f"# MongoDB URL: {MONGO_URL}")
        print(f"# Database: {DB_NAME}")
        print(f"# Timestamp: {time.strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"# Iterations per query: {iterations}")
        print(f"{'#'*80}\n")
        
        for query_name, query_config in BENCHMARK_QUERIES.items():
            result = await benchmark_query(db, query_name, query_config, iterations=iterations)
            results.append(result)
        
        # Summary report
        print(f"\n\n{'='*80}")
        print(f"📋 SUMMARY REPORT")
        print(f"{'='*80}\n")
        
        for result in results:
            print(f"{result['query_name']:40} | Avg: {result['average_ms']:7.2f}ms | P95: {result['p95_ms']:7.2f}ms | Stage: {result['plan_stage']}")
        
        print(f"\n{'='*80}")
        print(f"✅ Benchmark Complete!")
        print(f"\nNext Steps:")
        print(f"1. Deploy indexes: python backend/create_performance_indexes.py")
        print(f"2. Re-run this benchmark to compare metrics")
        print(f"3. Calculate improvement: (old_avg - new_avg) / old_avg * 100")
        print(f"{'='*80}\n")
        
        return results
        
    finally:
        client.close()


# ============================================================================
# MAIN ENTRY POINT
# ============================================================================

if __name__ == "__main__":
    iterations = 5  # Can be customized via CLI args
    
    try:
        asyncio.run(run_all_benchmarks(iterations=iterations))
    except KeyboardInterrupt:
        print("\n\n⚠️  Benchmark interrupted by user")
    except Exception as e:
        print(f"\n\n❌ Benchmark failed: {e}")
        import traceback
        traceback.print_exc()
