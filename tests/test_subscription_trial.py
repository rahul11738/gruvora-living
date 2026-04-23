import requests
import sys
import json
from datetime import datetime, timezone, timedelta

class SubscriptionTrialTester:
    def __init__(self, base_url="http://localhost:8000"):
        self.base_url = base_url
        self.token = None
        self.user_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        url = f"{self.base_url}/api/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        if headers: test_headers.update(headers)
        if self.token: test_headers['Authorization'] = f'Bearer {self.token}'

        try:
            if method == 'GET': response = requests.get(url, headers=test_headers, timeout=10)
            elif method == 'POST': response = requests.post(url, json=data, headers=test_headers, timeout=10)
            
            if response.status_code == expected_status:
                print(f"[PASS] {name}")
                return True, response.json()
            else:
                print(f"[FAIL] {name} (Expected {expected_status}, got {response.status_code})")
                print(f"   Response: {response.text[:200]}")
                return False, {}
        except Exception as e:
            print(f"[ERROR] {name}: {str(e)}")
            return False, {}

    def test_owner_trial_init(self):
        print("\n--- Testing Owner Trial Initialization ---")
        test_email = f"trial_test_{datetime.now().strftime('%H%M%S')}@example.com"
        owner_data = {
            "name": "Trial Test Owner",
            "email": test_email,
            "phone": "9999999999",
            "password": "TestPass123!",
            "gender": "male",
            "address": "Test Address",
            "aadhar_number": "123456789012",
            "aadhar_name": "Trial Test"
        }
        
        # 1. Register Owner
        success, reg_res = self.run_test("Register Owner", "POST", "auth/register/owner", 200, owner_data)
        if not success: return
        
        self.token = reg_res['token']
        self.user_id = reg_res['user']['id']

        # 2. Check Subscription Status
        success, status_res = self.run_test("Get Sub Status", "GET", "subscriptions/status", 200)
        if not success: return

        # 3. Verify Trial Details
        status = status_res.get('status')
        plan = status_res.get('subscription_plan')
        days_left = status_res.get('trial_days_remaining')
        
        if status == 'trial' and plan == 'basic' and days_left is not None:
            print(f"[PASS] SUCCESS: User is on '{plan}' trial with {days_left} days left.")
        else:
            print(f"[FAIL] FAILURE: Unexpected status state: {status_res}")

if __name__ == "__main__":
    tester = SubscriptionTrialTester()
    tester.test_owner_trial_init()
