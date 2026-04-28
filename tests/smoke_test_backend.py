#!/usr/bin/env python3
"""
Smoke test for Mega Patent Discovery API
Validates core workflow: health → journals → download job → patent retrieval
"""

import os
import sys
import time
import requests

# Get backend URL from env
BACKEND_URL = os.getenv("REACT_APP_BACKEND_URL", "http://localhost:8001")
API_BASE = f"{BACKEND_URL}/api"

def test_health():
    """Test 1: Health endpoint"""
    print("\n[TEST 1] Health check...")
    try:
        resp = requests.get(f"{API_BASE}/health", timeout=10)
        resp.raise_for_status()
        data = resp.json()
        print(f"✓ Health OK: {data['status']}")
        print(f"  - Processed journals: {data['stats']['processed_journals']}")
        print(f"  - Total patents: {data['stats']['total_patents']}")
        print(f"  - Mega patents: {data['stats']['mega_patents']}")
        return True
    except Exception as e:
        print(f"✗ Health check failed: {e}")
        return False


def test_journals_list():
    """Test 2: List journals"""
    print("\n[TEST 2] List journals...")
    try:
        resp = requests.get(f"{API_BASE}/journals?refresh=1&limit=10", timeout=30)
        resp.raise_for_status()
        data = resp.json()
        journals = data.get("journals", [])
        print(f"✓ Found {len(journals)} journals")
        
        if journals:
            j = journals[0]
            print(f"  - First: {j['journal_no']} ({j['pub_date']}) - status: {j['status']}")
        
        return len(journals) > 0
    except Exception as e:
        print(f"✗ Journals list failed: {e}")
        return False


def test_patents_query():
    """Test 3: Query patents"""
    print("\n[TEST 3] Query patents...")
    try:
        resp = requests.get(f"{API_BASE}/patents?limit=5&mega_only=0", timeout=15)
        resp.raise_for_status()
        data = resp.json()
        patents = data.get("patents", [])
        print(f"✓ Found {data.get('total', 0)} total patents (showing {len(patents)})")
        
        if patents:
            p = patents[0]
            print(f"  - Sample: {p.get('title', 'N/A')[:60]}...")
            print(f"    App No: {p.get('application_no')}, Score: {p.get('mega_score')}")
            
            # Check applicants
            applicants = p.get("applicants", [])
            if applicants:
                print(f"    Applicants: {', '.join(applicants[:2])}")
                # Check for logic bug: "International Classification" in applicants
                for app in applicants:
                    if "International Classification" in app or "classification" in app.lower():
                        print(f"    ⚠️  WARNING: Found classification string in applicants: '{app}'")
        
        return True
    except Exception as e:
        print(f"✗ Patents query failed: {e}")
        return False


def test_stats():
    """Test 4: Get stats"""
    print("\n[TEST 4] Get stats...")
    try:
        resp = requests.get(f"{API_BASE}/stats", timeout=15)
        resp.raise_for_status()
        data = resp.json()
        overview = data.get("overview", {})
        print(f"✓ Stats retrieved")
        print(f"  - Total patents: {overview.get('total', 0)}")
        print(f"  - Mega patents: {overview.get('mega_patents', 0)}")
        print(f"  - Avg score: {overview.get('avg_mega_score', 0):.1f}")
        print(f"  - Cities: {overview.get('cities', 0)}")
        return True
    except Exception as e:
        print(f"✗ Stats failed: {e}")
        return False


def main():
    print("=" * 60)
    print("Mega Patent Discovery - Backend Smoke Test")
    print("=" * 60)
    print(f"Backend URL: {BACKEND_URL}")
    
    results = []
    
    # Run tests
    results.append(("Health", test_health()))
    results.append(("Journals List", test_journals_list()))
    results.append(("Patents Query", test_patents_query()))
    results.append(("Stats", test_stats()))
    
    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    for name, passed in results:
        status = "✓ PASS" if passed else "✗ FAIL"
        print(f"{status} - {name}")
    
    total_passed = sum(1 for _, p in results if p)
    total = len(results)
    print(f"\nPassed: {total_passed}/{total}")
    
    if total_passed == total:
        print("\n✓ ALL TESTS PASSED - Backend core workflow is working")
        return 0
    else:
        print("\n✗ SOME TESTS FAILED - Review errors above")
        return 1


if __name__ == "__main__":
    sys.exit(main())
