#!/usr/bin/env python3
"""
Comprehensive Backend API Testing for Patent Journal Dashboard
Tests all endpoints and core functionality
"""

import requests
import json
import time
import sys
from datetime import datetime
from typing import Dict, List, Optional

# Use the public endpoint from frontend .env
BASE_URL = "https://patent-processor.preview.emergentagent.com"

class PatentAPITester:
    def __init__(self, base_url: str = BASE_URL):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'User-Agent': 'PatentDashboard-Tester/1.0'
        })
        
        # Test tracking
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        
        # Test data storage
        self.test_journal_no = None
        self.test_job_id = None
        
    def log_test(self, name: str, success: bool, details: str = "", response_data: dict = None):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            
        result = {
            "test_name": name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat(),
            "response_data": response_data
        }
        self.test_results.append(result)
        
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {name}")
        if details:
            print(f"    {details}")
        if not success and response_data:
            print(f"    Response: {response_data}")
        print()

    def test_health_endpoint(self) -> bool:
        """Test backend health check endpoint"""
        try:
            response = self.session.get(f"{self.base_url}/api/health", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ["status", "time", "services"]
                
                if all(field in data for field in required_fields):
                    services = data.get("services", {})
                    has_selenium = services.get("selenium", False)
                    has_pdfplumber = services.get("pdfplumber", False)
                    
                    details = f"Status: {data['status']}, Selenium: {has_selenium}, PDFPlumber: {has_pdfplumber}"
                    self.log_test("Backend Health Check", True, details, data)
                    return True
                else:
                    self.log_test("Backend Health Check", False, f"Missing required fields: {required_fields}", data)
                    return False
            else:
                self.log_test("Backend Health Check", False, f"HTTP {response.status_code}", {"status_code": response.status_code})
                return False
                
        except Exception as e:
            self.log_test("Backend Health Check", False, f"Exception: {str(e)}")
            return False

    def test_journals_list(self) -> bool:
        """Test journal list API"""
        try:
            response = self.session.get(f"{self.base_url}/api/journals", timeout=15)
            
            if response.status_code == 200:
                data = response.json()
                
                if "journals" in data and isinstance(data["journals"], list):
                    journals = data["journals"]
                    total = data.get("total", 0)
                    
                    if len(journals) > 0:
                        # Check first journal structure
                        first_journal = journals[0]
                        required_fields = ["journal_no", "pub_date", "status"]
                        
                        if all(field in first_journal for field in required_fields):
                            # Store a test journal for download testing
                            for journal in journals:
                                if journal.get("status") == "available" and journal.get("journal_no") != "UPCOMING":
                                    self.test_journal_no = journal["journal_no"]
                                    break
                            
                            details = f"Found {len(journals)} journals, total: {total}"
                            if self.test_journal_no:
                                details += f", test journal: {self.test_journal_no}"
                            
                            self.log_test("Journal List API", True, details, {"count": len(journals), "total": total})
                            return True
                        else:
                            self.log_test("Journal List API", False, f"Missing required fields in journal: {required_fields}", first_journal)
                            return False
                    else:
                        self.log_test("Journal List API", True, "Empty journal list (expected for new installation)", data)
                        return True
                else:
                    self.log_test("Journal List API", False, "Invalid response structure", data)
                    return False
            else:
                self.log_test("Journal List API", False, f"HTTP {response.status_code}", {"status_code": response.status_code})
                return False
                
        except Exception as e:
            self.log_test("Journal List API", False, f"Exception: {str(e)}")
            return False

    def test_refresh_journals(self) -> bool:
        """Test journal refresh (scraping)"""
        try:
            response = self.session.get(f"{self.base_url}/api/journals?refresh=1", timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                
                if "journals" in data and isinstance(data["journals"], list):
                    journals = data["journals"]
                    
                    # Should have at least some journals after refresh
                    if len(journals) > 1:  # At least upcoming + some real journals
                        # Update test journal
                        for journal in journals:
                            if journal.get("status") == "available" and journal.get("journal_no") != "UPCOMING":
                                self.test_journal_no = journal["journal_no"]
                                break
                        
                        details = f"Refreshed and found {len(journals)} journals"
                        if self.test_journal_no:
                            details += f", test journal: {self.test_journal_no}"
                        
                        self.log_test("Journal Refresh (Scraping)", True, details, {"count": len(journals)})
                        return True
                    else:
                        self.log_test("Journal Refresh (Scraping)", False, "No journals found after refresh", data)
                        return False
                else:
                    self.log_test("Journal Refresh (Scraping)", False, "Invalid response structure", data)
                    return False
            else:
                self.log_test("Journal Refresh (Scraping)", False, f"HTTP {response.status_code}", {"status_code": response.status_code})
                return False
                
        except Exception as e:
            self.log_test("Journal Refresh (Scraping)", False, f"Exception: {str(e)}")
            return False

    def test_download_journal(self) -> bool:
        """Test journal download job creation"""
        if not self.test_journal_no:
            self.log_test("Journal Download Job", False, "No test journal available")
            return False
            
        try:
            payload = {
                "journal_no": self.test_journal_no,
                "force": False
            }
            
            response = self.session.post(
                f"{self.base_url}/api/journals/download",
                json=payload,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                
                required_fields = ["job_id", "status", "journal_no"]
                if all(field in data for field in required_fields):
                    self.test_job_id = data["job_id"]
                    
                    details = f"Job created: {self.test_job_id} for journal {data['journal_no']}"
                    self.log_test("Journal Download Job", True, details, data)
                    return True
                else:
                    self.log_test("Journal Download Job", False, f"Missing required fields: {required_fields}", data)
                    return False
            else:
                self.log_test("Journal Download Job", False, f"HTTP {response.status_code}", {"status_code": response.status_code})
                return False
                
        except Exception as e:
            self.log_test("Journal Download Job", False, f"Exception: {str(e)}")
            return False

    def test_job_status(self) -> bool:
        """Test job status tracking"""
        if not self.test_job_id:
            self.log_test("Job Status Tracking", False, "No test job available")
            return False
            
        try:
            # Poll job status for up to 2 minutes
            max_polls = 24  # 2 minutes with 5-second intervals
            poll_count = 0
            
            while poll_count < max_polls:
                response = self.session.get(f"{self.base_url}/api/jobs/{self.test_job_id}", timeout=10)
                
                if response.status_code == 200:
                    data = response.json()
                    
                    required_fields = ["job_id", "status", "progress", "message"]
                    if all(field in data for field in required_fields):
                        status = data["status"]
                        progress = data["progress"]
                        message = data["message"]
                        
                        print(f"    Job {self.test_job_id[:8]}: {status} - {progress}% - {message}")
                        
                        if status in ["complete", "failed"]:
                            success = status == "complete"
                            details = f"Job {status} with {progress}% progress: {message}"
                            self.log_test("Job Status Tracking", success, details, data)
                            return success
                        elif status in ["running", "started"]:
                            poll_count += 1
                            time.sleep(5)  # Wait 5 seconds before next poll
                        else:
                            self.log_test("Job Status Tracking", False, f"Unknown job status: {status}", data)
                            return False
                    else:
                        self.log_test("Job Status Tracking", False, f"Missing required fields: {required_fields}", data)
                        return False
                else:
                    self.log_test("Job Status Tracking", False, f"HTTP {response.status_code}", {"status_code": response.status_code})
                    return False
            
            # Timeout reached
            self.log_test("Job Status Tracking", False, "Job did not complete within 2 minutes")
            return False
            
        except Exception as e:
            self.log_test("Job Status Tracking", False, f"Exception: {str(e)}")
            return False

    def test_patents_api(self) -> bool:
        """Test patents API with various filters"""
        try:
            # Test basic patents endpoint
            response = self.session.get(f"{self.base_url}/api/patents?limit=10", timeout=15)
            
            if response.status_code == 200:
                data = response.json()
                
                if "patents" in data and "total" in data:
                    patents = data["patents"]
                    total = data["total"]
                    
                    if len(patents) > 0:
                        # Check patent structure
                        first_patent = patents[0]
                        required_fields = ["application_no", "title", "field", "num_claims"]
                        
                        if all(field in first_patent for field in required_fields):
                            details = f"Found {len(patents)} patents out of {total} total"
                            self.log_test("Patents API", True, details, {"count": len(patents), "total": total})
                            
                            # Test filtering by field
                            if first_patent.get("field"):
                                field = first_patent["field"]
                                filter_response = self.session.get(f"{self.base_url}/api/patents?field={field}&limit=5", timeout=10)
                                if filter_response.status_code == 200:
                                    filter_data = filter_response.json()
                                    filtered_patents = filter_data.get("patents", [])
                                    self.log_test("Patents Field Filter", True, f"Filtered by {field}: {len(filtered_patents)} results")
                                else:
                                    self.log_test("Patents Field Filter", False, f"HTTP {filter_response.status_code}")
                            
                            return True
                        else:
                            self.log_test("Patents API", False, f"Missing required fields in patent: {required_fields}", first_patent)
                            return False
                    else:
                        self.log_test("Patents API", True, "No patents found (expected for new installation)", data)
                        return True
                else:
                    self.log_test("Patents API", False, "Invalid response structure", data)
                    return False
            else:
                self.log_test("Patents API", False, f"HTTP {response.status_code}", {"status_code": response.status_code})
                return False
                
        except Exception as e:
            self.log_test("Patents API", False, f"Exception: {str(e)}")
            return False

    def test_stats_api(self) -> bool:
        """Test statistics API"""
        try:
            response = self.session.get(f"{self.base_url}/api/stats", timeout=15)
            
            if response.status_code == 200:
                data = response.json()
                
                required_sections = ["overview", "by_field", "by_city", "by_pub_type"]
                if all(section in data for section in required_sections):
                    overview = data["overview"]
                    by_field = data["by_field"]
                    by_city = data["by_city"]
                    
                    details = f"Overview: {overview.get('total', 0)} patents, {len(by_field)} fields, {len(by_city)} cities"
                    self.log_test("Statistics API", True, details, {"overview": overview})
                    return True
                else:
                    self.log_test("Statistics API", False, f"Missing required sections: {required_sections}", data)
                    return False
            else:
                self.log_test("Statistics API", False, f"HTTP {response.status_code}", {"status_code": response.status_code})
                return False
                
        except Exception as e:
            self.log_test("Statistics API", False, f"Exception: {str(e)}")
            return False

    def test_fields_api(self) -> bool:
        """Test fields API"""
        try:
            response = self.session.get(f"{self.base_url}/api/fields", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                
                if "fields" in data and isinstance(data["fields"], list):
                    fields = data["fields"]
                    details = f"Found {len(fields)} technology fields"
                    self.log_test("Fields API", True, details, {"count": len(fields)})
                    return True
                else:
                    self.log_test("Fields API", False, "Invalid response structure", data)
                    return False
            else:
                self.log_test("Fields API", False, f"HTTP {response.status_code}", {"status_code": response.status_code})
                return False
                
        except Exception as e:
            self.log_test("Fields API", False, f"Exception: {str(e)}")
            return False

    def test_jobs_list(self) -> bool:
        """Test jobs list API"""
        try:
            response = self.session.get(f"{self.base_url}/api/jobs", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                
                if "jobs" in data and isinstance(data["jobs"], list):
                    jobs = data["jobs"]
                    details = f"Found {len(jobs)} jobs in history"
                    self.log_test("Jobs List API", True, details, {"count": len(jobs)})
                    return True
                else:
                    self.log_test("Jobs List API", False, "Invalid response structure", data)
                    return False
            else:
                self.log_test("Jobs List API", False, f"HTTP {response.status_code}", {"status_code": response.status_code})
                return False
                
        except Exception as e:
            self.log_test("Jobs List API", False, f"Exception: {str(e)}")
            return False

    def run_all_tests(self) -> dict:
        """Run all backend tests"""
        print("🧪 Starting Patent Dashboard Backend API Tests")
        print(f"🌐 Testing against: {self.base_url}")
        print("=" * 60)
        
        # Core API tests
        self.test_health_endpoint()
        self.test_journals_list()
        self.test_refresh_journals()
        
        # Job processing tests (only if we have journals)
        if self.test_journal_no:
            self.test_download_journal()
            if self.test_job_id:
                self.test_job_status()
        
        # Data API tests
        self.test_patents_api()
        self.test_stats_api()
        self.test_fields_api()
        self.test_jobs_list()
        
        # Summary
        print("=" * 60)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        print(f"📈 Success Rate: {success_rate:.1f}%")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
        else:
            print("⚠️  Some tests failed - check details above")
        
        return {
            "total_tests": self.tests_run,
            "passed_tests": self.tests_passed,
            "success_rate": success_rate,
            "test_results": self.test_results
        }

def main():
    """Main test execution"""
    tester = PatentAPITester()
    results = tester.run_all_tests()
    
    # Return appropriate exit code
    if results["passed_tests"] == results["total_tests"]:
        return 0
    else:
        return 1

if __name__ == "__main__":
    sys.exit(main())