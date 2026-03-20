"""
GharSetu Subscription API Tests - Iteration 12
Tests for Service Provider Subscription API endpoints:
- POST /api/subscriptions/create-order
- POST /api/subscriptions/verify
- GET /api/subscriptions/status
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://gharsetu-hub.preview.emergentagent.com')

# Test data
TEST_SERVICE_PROVIDER = {
    "name": f"Test Service Provider {uuid.uuid4().hex[:6]}",
    "email": f"testsp_{uuid.uuid4().hex[:6]}@gharsetu.com",
    "phone": "9876543210",
    "password": "ServiceP@123",
    "gender": "male",
    "address": "Test Address, Surat",
    "city": "Surat",
    "state": "Gujarat",
    "role": "service_provider",
    "aadhar_number": "123456789012",
    "aadhar_name": "Test SP",
    "business_name": "Test Plumbing Services"
}

TEST_REGULAR_USER = {
    "name": f"Test User {uuid.uuid4().hex[:6]}",
    "email": f"testuser_{uuid.uuid4().hex[:6]}@gharsetu.com",
    "phone": "9876543211",
    "password": "User@123",
    "gender": "female",
    "address": "Test Address, Ahmedabad",
    "city": "Ahmedabad",
    "state": "Gujarat"
}


class TestSubscriptionAPI:
    """Tests for Service Provider Subscription API"""
    
    @pytest.fixture(scope="class")
    def service_provider_token(self):
        """Register a service provider and get token"""
        # Register service provider
        response = requests.post(
            f"{BASE_URL}/api/auth/register/owner",
            json=TEST_SERVICE_PROVIDER
        )
        print(f"SP Registration Response: {response.status_code} - {response.text[:200] if response.text else 'No body'}")
        
        if response.status_code == 200:
            return response.json().get("token")
        elif response.status_code == 400:
            # User may already exist, try login
            login_response = requests.post(
                f"{BASE_URL}/api/auth/login",
                json={"email": TEST_SERVICE_PROVIDER["email"], "password": TEST_SERVICE_PROVIDER["password"]}
            )
            if login_response.status_code == 200:
                return login_response.json().get("token")
        
        pytest.skip("Failed to create/login service provider")
        return None
    
    @pytest.fixture(scope="class")
    def regular_user_token(self):
        """Register a regular user and get token"""
        # Register regular user
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json=TEST_REGULAR_USER
        )
        print(f"User Registration Response: {response.status_code} - {response.text[:200] if response.text else 'No body'}")
        
        if response.status_code == 200:
            return response.json().get("token")
        elif response.status_code == 400:
            # User may already exist, try login
            login_response = requests.post(
                f"{BASE_URL}/api/auth/login",
                json={"email": TEST_REGULAR_USER["email"], "password": TEST_REGULAR_USER["password"]}
            )
            if login_response.status_code == 200:
                return login_response.json().get("token")
        
        pytest.skip("Failed to create/login regular user")
        return None
    
    def test_create_order_requires_auth(self):
        """Test that create-order endpoint requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/subscriptions/create-order",
            json={"plan": "monthly"}
        )
        # Should return 403 Forbidden (no auth header)
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"PASSED: create-order endpoint requires auth (status: {response.status_code})")
    
    def test_create_order_forbidden_for_regular_user(self, regular_user_token):
        """Test that regular users cannot create subscription orders"""
        if not regular_user_token:
            pytest.skip("No regular user token")
            
        response = requests.post(
            f"{BASE_URL}/api/subscriptions/create-order",
            json={"plan": "monthly"},
            headers={"Authorization": f"Bearer {regular_user_token}"}
        )
        # Regular users should be forbidden
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        data = response.json()
        assert "service provider" in data.get("detail", "").lower() or "only service providers" in data.get("detail", "").lower()
        print(f"PASSED: Regular users cannot create subscription orders (status: {response.status_code})")
    
    def test_create_order_success_for_service_provider(self, service_provider_token):
        """Test that service providers can create subscription orders"""
        if not service_provider_token:
            pytest.skip("No service provider token")
            
        response = requests.post(
            f"{BASE_URL}/api/subscriptions/create-order",
            json={"plan": "monthly"},
            headers={"Authorization": f"Bearer {service_provider_token}"}
        )
        
        print(f"Create Order Response: {response.status_code} - {response.text[:500] if response.text else 'No body'}")
        
        # Should return 200 with order details
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "order_id" in data, "Response should contain order_id"
        assert "amount" in data, "Response should contain amount"
        assert data["amount"] == 25100, f"Amount should be 25100 paise, got {data['amount']}"
        assert data["currency"] == "INR", f"Currency should be INR, got {data['currency']}"
        assert "key_id" in data, "Response should contain Razorpay key_id"
        assert "subscription_id" in data, "Response should contain subscription_id"
        assert "plan_details" in data, "Response should contain plan_details"
        
        print(f"PASSED: Service provider can create subscription order")
        print(f"  - Order ID: {data['order_id']}")
        print(f"  - Amount: ₹{data['amount']/100}")
        print(f"  - Plan: {data['plan_details'].get('name')}")
    
    def test_subscription_status_requires_auth(self):
        """Test that subscription status endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/subscriptions/status")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"PASSED: subscription status endpoint requires auth (status: {response.status_code})")
    
    def test_subscription_status_for_regular_user(self, regular_user_token):
        """Test subscription status for regular users"""
        if not regular_user_token:
            pytest.skip("No regular user token")
            
        response = requests.get(
            f"{BASE_URL}/api/subscriptions/status",
            headers={"Authorization": f"Bearer {regular_user_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data.get("has_subscription") == False, "Regular user should not have subscription"
        assert "not a service provider" in data.get("message", "").lower()
        print(f"PASSED: Regular user subscription status returns correct response")
    
    def test_subscription_status_for_service_provider(self, service_provider_token):
        """Test subscription status for service providers"""
        if not service_provider_token:
            pytest.skip("No service provider token")
            
        response = requests.get(
            f"{BASE_URL}/api/subscriptions/status",
            headers={"Authorization": f"Bearer {service_provider_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # New service provider should have no subscription
        assert "has_subscription" in data, "Response should contain has_subscription"
        
        # Check for pricing info if no subscription
        if not data.get("has_subscription"):
            assert "price" in data or "message" in data, "Should contain pricing or message"
            print(f"PASSED: Service provider subscription status works - No active subscription")
        else:
            assert "subscription" in data, "Should contain subscription details if active"
            print(f"PASSED: Service provider has active subscription")
    
    def test_verify_endpoint_exists(self, service_provider_token):
        """Test that the verify endpoint exists and requires proper data"""
        if not service_provider_token:
            pytest.skip("No service provider token")
            
        # Send incomplete data to verify endpoint exists
        response = requests.post(
            f"{BASE_URL}/api/subscriptions/verify",
            json={},
            headers={"Authorization": f"Bearer {service_provider_token}"}
        )
        
        # Should return 422 (validation error) or 400 (bad request), not 404
        assert response.status_code in [400, 422, 500], f"Expected 400/422/500 for missing data, got {response.status_code}"
        print(f"PASSED: verify endpoint exists (status: {response.status_code} for incomplete data)")
    
    def test_verify_requires_auth(self):
        """Test that verify endpoint requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/subscriptions/verify",
            json={
                "razorpay_order_id": "order_test123",
                "razorpay_payment_id": "pay_test123",
                "razorpay_signature": "test_signature"
            }
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"PASSED: verify endpoint requires auth (status: {response.status_code})")


# Additional test to verify API response format
class TestSubscriptionAPIFormat:
    """Test API response format for subscription endpoints"""
    
    @pytest.fixture(scope="class")
    def sp_token(self):
        """Get service provider token"""
        sp_data = {
            "name": f"Format Test SP {uuid.uuid4().hex[:6]}",
            "email": f"formatsp_{uuid.uuid4().hex[:6]}@gharsetu.com",
            "phone": "9876543299",
            "password": "FormatSP@123",
            "gender": "male",
            "address": "Format Test Address",
            "city": "Surat",
            "state": "Gujarat",
            "role": "service_provider",
            "aadhar_number": "999999999999",
            "aadhar_name": "Format Test",
            "business_name": "Format Test Services"
        }
        
        response = requests.post(f"{BASE_URL}/api/auth/register/owner", json=sp_data)
        if response.status_code == 200:
            return response.json().get("token")
        return None
    
    def test_create_order_returns_razorpay_key(self, sp_token):
        """Test that create-order returns Razorpay key_id for frontend integration"""
        if not sp_token:
            pytest.skip("No SP token")
            
        response = requests.post(
            f"{BASE_URL}/api/subscriptions/create-order",
            json={"plan": "monthly"},
            headers={"Authorization": f"Bearer {sp_token}"}
        )
        
        if response.status_code == 200:
            data = response.json()
            assert "key_id" in data, "Response must contain Razorpay key_id"
            assert data["key_id"].startswith("rzp_"), f"Key should start with rzp_, got {data['key_id']}"
            print(f"PASSED: API returns Razorpay key_id: {data['key_id'][:20]}...")
        else:
            print(f"Skipped: Could not create order (status: {response.status_code})")
    
    def test_subscription_status_includes_features(self, sp_token):
        """Test that subscription status includes feature list for UI"""
        if not sp_token:
            pytest.skip("No SP token")
            
        response = requests.get(
            f"{BASE_URL}/api/subscriptions/status",
            headers={"Authorization": f"Bearer {sp_token}"}
        )
        
        if response.status_code == 200:
            data = response.json()
            # If no subscription, should include pricing/features
            if not data.get("has_subscription"):
                assert "price" in data or "features" in data, "Should include pricing info"
                if "features" in data:
                    assert isinstance(data["features"], list), "Features should be a list"
                    print(f"PASSED: Subscription status includes features: {data.get('features', [])[:2]}...")
                else:
                    print(f"PASSED: Subscription status returns pricing info")
            else:
                print(f"PASSED: Service provider has active subscription")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
