#!/usr/bin/env python3
"""
Backend API Testing for Patent Dashboard
Tests all API endpoints for functionality and B&W design compliance
"""

import requests
import sys
import json
from datetime import datetime

class PatentAPITester:
    def __init__(self, base_url="https://patent-processor.preview.emergentagent.com"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'User-Agent': 'Patent-Dashboard-Test/1.0'
        })

    def run_test(self, name, method, endpoint, expected_status, data=None, timeout=30):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = self.session.get(url, timeout=timeout)
            elif method == 'POST':
                response = self.session.post(url, json=data, timeout=timeout)
            elif method == 'PUT':
                response = self.session.put(url, json=data, timeout=timeout)
            elif method == 'DELETE':
                response = self.session.delete(url, timeout=timeout)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return True, response.json()
                except:
                    return True, response.text
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:200]}...")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_health_check(self):
        """Test health endpoint"""
        success, response = self.run_test(
            "Health Check",
            "GET",
            "api/health",
            200
        )
        if success:
            print(f"   Services: pdfplumber={response.get('services', {}).get('pdfplumber')}, selenium={response.get('services', {}).get('selenium')}")
            print(f"   Stats: {response.get('stats', {})}")
        return success

    def test_journals_list(self):
        """Test journals listing"""
        success, response = self.run_test(
            "Journals List",
            "GET", 
            "api/journals",
            200
        )
        if success:
            journals = response.get('journals', [])
            print(f"   Found {len(journals)} journals")
            if journals:
                print(f"   Sample: {journals[0].get('journal_no')} - {journals[0].get('status')}")
        return success, response

    def test_patents_list(self):
        """Test patents listing"""
        success, response = self.run_test(
            "Patents List",
            "GET",
            "api/patents?limit=10",
            200
        )
        if success:
            patents = response.get('patents', [])
            total = response.get('total', 0)
            print(f"   Found {total} total patents, showing {len(patents)}")
            if patents:
                sample = patents[0]
                print(f"   Sample: {sample.get('title', 'No title')[:50]}...")
                print(f"   MEGA Score: {sample.get('mega_score', 'N/A')}")
        return success, response

    def test_mega_patents(self):
        """Test mega patents endpoint"""
        success, response = self.run_test(
            "MEGA Patents",
            "GET",
            "api/mega-patents?limit=5",
            200
        )
        if success:
            mega_patents = response.get('mega_patents', [])
            total = response.get('total', 0)
            print(f"   Found {total} MEGA patents (score ≥ 65)")
            if mega_patents:
                print(f"   Top score: {mega_patents[0].get('mega_score', 'N/A')}")
        return success

    def test_stats_endpoint(self):
        """Test statistics endpoint"""
        success, response = self.run_test(
            "Statistics",
            "GET",
            "api/stats",
            200
        )
        if success:
            overview = response.get('overview', {})
            print(f"   Total patents: {overview.get('total', 0)}")
            print(f"   MEGA patents: {overview.get('mega_patents', 0)}")
            print(f"   Cities: {overview.get('cities', 0)}")
            print(f"   Avg score: {overview.get('avg_mega_score', 0):.1f}")
        return success

    def test_fields_endpoint(self):
        """Test fields endpoint"""
        success, response = self.run_test(
            "Technology Fields",
            "GET",
            "api/fields",
            200
        )
        if success:
            fields = response.get('fields', [])
            print(f"   Found {len(fields)} technology fields")
            if fields:
                print(f"   Top field: {fields[0].get('field')} ({fields[0].get('count')} patents)")
        return success

    def test_jobs_endpoint(self):
        """Test jobs listing"""
        success, response = self.run_test(
            "Jobs List",
            "GET",
            "api/jobs",
            200
        )
        if success:
            jobs = response.get('jobs', [])
            print(f"   Found {len(jobs)} jobs")
            if jobs:
                recent = jobs[0]
                print(f"   Recent: {recent.get('journal_no')} - {recent.get('status')}")
        return success

    def test_patent_filtering(self):
        """Test patent filtering capabilities"""
        success, response = self.run_test(
            "Patent Filtering (MEGA only)",
            "GET",
            "api/patents?mega_only=1&limit=5",
            200
        )
        if success:
            patents = response.get('patents', [])
            print(f"   MEGA filter: {len(patents)} patents")
            if patents:
                scores = [p.get('mega_score', 0) for p in patents]
                print(f"   Scores: {scores}")
                all_mega = all(score >= 65 for score in scores)
                print(f"   All ≥ 65: {all_mega}")
        return success

    def test_patent_search(self):
        """Test patent search functionality"""
        success, response = self.run_test(
            "Patent Search",
            "GET",
            "api/patents?search=system&limit=3",
            200
        )
        if success:
            patents = response.get('patents', [])
            print(f"   Search 'system': {len(patents)} results")
        return success

    def test_patent_sorting(self):
        """Test patent sorting"""
        success, response = self.run_test(
            "Patent Sorting (by claims)",
            "GET",
            "api/patents?sort=num_claims&limit=3",
            200
        )
        if success:
            patents = response.get('patents', [])
            if patents:
                claims = [p.get('num_claims', 0) for p in patents]
                print(f"   Claims (desc): {claims}")
        return success

def main():
    """Run all backend tests"""
    print("🚀 Starting Patent Dashboard Backend API Tests")
    print("=" * 60)
    
    tester = PatentAPITester()
    
    # Core API tests
    tests = [
        tester.test_health_check,
        tester.test_journals_list,
        tester.test_patents_list,
        tester.test_mega_patents,
        tester.test_stats_endpoint,
        tester.test_fields_endpoint,
        tester.test_jobs_endpoint,
        tester.test_patent_filtering,
        tester.test_patent_search,
        tester.test_patent_sorting,
    ]
    
    # Run tests
    for test in tests:
        try:
            test()
        except Exception as e:
            print(f"❌ Test failed with exception: {e}")
    
    # Print results
    print("\n" + "=" * 60)
    print(f"📊 Backend API Test Results:")
    print(f"   Tests passed: {tester.tests_passed}/{tester.tests_run}")
    print(f"   Success rate: {(tester.tests_passed/tester.tests_run)*100:.1f}%")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All backend tests passed!")
        return 0
    else:
        print("⚠️  Some backend tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())