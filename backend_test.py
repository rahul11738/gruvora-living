import requests
import sys
import json
from datetime import datetime

class GharSetuAPITester:
    def __init__(self, base_url="https://gharsetu-hub.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if headers:
            test_headers.update(headers)
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=30)

            success = response.status_code == expected_status
            
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return True, response.json()
                except:
                    return True, {}
            else:
                self.failed_tests.append({
                    'name': name,
                    'expected': expected_status,
                    'actual': response.status_code,
                    'response': response.text[:500] if response.text else 'No response body'
                })
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:200]}...")
                return False, {}

        except requests.exceptions.RequestException as e:
            self.failed_tests.append({
                'name': name,
                'error': str(e),
                'expected': expected_status,
                'actual': 'Connection Error'
            })
            print(f"❌ Failed - Connection Error: {str(e)}")
            return False, {}

    def test_health_check(self):
        """Test health check endpoint"""
        return self.run_test("Health Check", "GET", "health", 200)

    def test_categories_endpoint(self):
        """Test categories endpoint"""
        return self.run_test("Get Categories", "GET", "categories", 200)

    def test_user_registration(self):
        """Test user registration"""
        test_email = f"testuser_{datetime.now().strftime('%Y%m%d_%H%M%S')}@example.com"
        user_data = {
            "name": "Test User",
            "email": test_email,
            "phone": "9876543210",
            "password": "TestPass123!",
            "gender": "male",
            "address": "Test Address, Surat, Gujarat"
        }
        
        success, response = self.run_test("User Registration", "POST", "auth/register", 200, user_data)
        if success and 'token' in response:
            print(f"   User ID: {response.get('user', {}).get('id', 'Not found')}")
            return success, response
        return success, response

    def test_owner_registration(self):
        """Test owner registration"""
        test_email = f"testowner_{datetime.now().strftime('%Y%m%d_%H%M%S')}@example.com"
        owner_data = {
            "name": "Test Owner",
            "email": test_email,
            "phone": "9876543211",
            "password": "TestPass123!",
            "gender": "female",
            "address": "Test Owner Address, Ahmedabad, Gujarat",
            "aadhar_number": "123456789012",
            "aadhar_name": "Test Owner Aadhar Name"
        }
        
        success, response = self.run_test("Owner Registration", "POST", "auth/register/owner", 200, owner_data)
        if success and 'token' in response:
            print(f"   Owner ID: {response.get('user', {}).get('id', 'Not found')}")
            return success, response
        return success, response

    def test_user_login(self):
        """Test user login with registered user"""
        # First register a user
        test_email = f"logintest_{datetime.now().strftime('%Y%m%d_%H%M%S')}@example.com"
        user_data = {
            "name": "Login Test User",
            "email": test_email,
            "phone": "9876543212",
            "password": "TestPass123!",
            "gender": "male",
            "address": "Login Test Address, Surat, Gujarat"
        }
        
        reg_success, reg_response = self.run_test("User Registration for Login Test", "POST", "auth/register", 200, user_data)
        if not reg_success:
            return False, {}
        
        # Now test login
        login_data = {
            "email": test_email,
            "password": "TestPass123!"
        }
        
        success, response = self.run_test("User Login", "POST", "auth/login", 200, login_data)
        if success and 'token' in response:
            self.token = response['token']
            self.user_id = response.get('user', {}).get('id')
            print(f"   Login successful, token received")
            return True, response
        return success, response

    def test_auth_me_endpoint(self):
        """Test authenticated user info endpoint"""
        if not self.token:
            print("⚠️  Skipping auth/me test - no token available")
            return False, {}
        
        return self.run_test("Get Current User Info", "GET", "auth/me", 200)

    def test_listings_endpoint(self):
        """Test listings endpoint"""
        return self.run_test("Get Listings", "GET", "listings", 200)

    def test_trending_listings(self):
        """Test trending listings endpoint"""
        return self.run_test("Get Trending Listings", "GET", "listings/trending", 200)

    def test_chatbot_endpoint(self):
        """Test chatbot endpoint"""
        if not self.token:
            print("⚠️  Skipping chatbot test - no token available")
            return False, {}
        
        chat_data = {
            "message": "Hello, I'm looking for a 2 BHK apartment in Surat"
        }
        
        return self.run_test("Chatbot Interaction", "POST", "chat", 200, chat_data)

    def test_invalid_endpoints(self):
        """Test invalid endpoints return proper errors"""
        success, _ = self.run_test("Invalid Endpoint", "GET", "nonexistent", 404)
        return success

    def print_summary(self):
        """Print test results summary"""
        print(f"\n" + "="*60)
        print(f"📊 TEST SUMMARY")
        print(f"="*60)
        print(f"Total Tests: {self.tests_run}")
        print(f"Passed: {self.tests_passed}")
        print(f"Failed: {len(self.failed_tests)}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%" if self.tests_run > 0 else "0%")
        
        if self.failed_tests:
            print(f"\n❌ FAILED TESTS:")
            for failure in self.failed_tests:
                print(f"   • {failure['name']}")
                if 'error' in failure:
                    print(f"     Error: {failure['error']}")
                else:
                    print(f"     Expected: {failure['expected']}, Got: {failure['actual']}")
                    if 'response' in failure:
                        print(f"     Response: {failure['response'][:100]}...")
        
        print(f"\n" + "="*60)
        return len(self.failed_tests) == 0

def main():
    print("🏠 GharSetu API Testing Suite")
    print("="*60)
    
    tester = GharSetuAPITester()
    
    # Test core endpoints
    tester.test_health_check()
    tester.test_categories_endpoint()
    
    # Test authentication flows
    tester.test_user_registration()
    tester.test_owner_registration()
    tester.test_user_login()
    tester.test_auth_me_endpoint()
    
    # Test listings
    tester.test_listings_endpoint()
    tester.test_trending_listings()
    
    # Test chatbot
    tester.test_chatbot_endpoint()
    
    # Test error handling
    tester.test_invalid_endpoints()
    
    # Print summary
    all_passed = tester.print_summary()
    
    return 0 if all_passed else 1

if __name__ == "__main__":
    sys.exit(main())