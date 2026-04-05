"""
GharSetu Payment API Tests
Tests: Razorpay Payment Configuration, Order Creation, Payment Verification
"""
import pytest
import requests
import os
import uuid

BASE_URL = (os.environ.get('BASE_URL') or os.environ.get('REACT_APP_BACKEND_URL') or 'http://127.0.0.1:8001').rstrip('/')


class TestPaymentConfig:
    """Payment configuration endpoint tests"""

    def test_payment_config_endpoint(self):
        """Test payment config returns Razorpay key and enabled status"""
        response = requests.get(f"{BASE_URL}/api/payments/config")
        assert response.status_code == 200
        data = response.json()

        # Verify required fields
        assert "key_id" in data, "key_id not found in response"
        assert "enabled" in data, "enabled not found in response"

        # Some local/dev environments intentionally disable payment gateway.
        if not data.get("enabled"):
            pytest.skip("Payment gateway disabled in this environment")

        # Verify Razorpay key format (starts with rzp_test_ or rzp_live_)
        assert data["key_id"].startswith("rzp_"), f"Invalid Razorpay key format: {data['key_id']}"

        print(f"SUCCESS: Payment config - key_id: {data['key_id']}, enabled: {data['enabled']}")


class TestPaymentFlow:
    """Payment order creation and verification tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get auth token for payment tests"""
        unique_id = str(uuid.uuid4())[:8]
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "name": f"TEST Payment User {unique_id}",
            "email": f"TEST_payment_{unique_id}@test.com",
            "phone": "9876543210",
            "password": "testpass123",
            "gender": "male",
            "address": "Test Address",
            "city": "Surat"
        })
        
        if response.status_code == 200:
            return response.json()["token"]
        return None

    def test_create_payment_order(self, auth_token):
        """Test creating a Razorpay payment order"""
        if not auth_token:
            pytest.skip("Auth token not available")
        
        # First get a listing ID
        listings_response = requests.get(f"{BASE_URL}/api/listings?category=stay&limit=1")
        if listings_response.status_code != 200 or not listings_response.json().get("listings"):
            pytest.skip("No stay listings available for payment test")
        
        listing = listings_response.json()["listings"][0]
        listing_id = listing["id"]
        
        # Create payment order
        response = requests.post(
            f"{BASE_URL}/api/payments/create-order",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "amount": 200000,  # 2000 INR in paise
                "listing_id": listing_id,
                "booking_type": "stay",
                "guests": 2
            }
        )
        
        assert response.status_code == 200, f"Failed to create order: {response.text}"
        data = response.json()
        
        # Verify order response
        assert "order_id" in data, "order_id not found in response"
        assert data["order_id"].startswith("order_"), f"Invalid order_id format: {data['order_id']}"
        
        print(f"SUCCESS: Payment order created - order_id: {data['order_id']}")
        return data["order_id"]

    def test_payment_order_requires_auth(self):
        """Test payment order creation requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/payments/create-order",
            json={
                "amount": 100000,
                "listing_id": "test",
                "booking_type": "stay"
            }
        )
        
        assert response.status_code in [401, 403], "Should require authentication"
        print("SUCCESS: Payment order correctly requires authentication")


class TestBookingFlow:
    """Booking with payment tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get auth token for booking tests"""
        unique_id = str(uuid.uuid4())[:8]
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "name": f"TEST Booking User {unique_id}",
            "email": f"TEST_booking_{unique_id}@test.com",
            "phone": "9876543210",
            "password": "testpass123",
            "gender": "male",
            "address": "Test Address",
            "city": "Surat"
        })
        
        if response.status_code == 200:
            return response.json()["token"]
        return None

    def test_create_booking(self, auth_token):
        """Test creating a booking for a listing"""
        if not auth_token:
            pytest.skip("Auth token not available")
        
        # Get a listing
        listings_response = requests.get(f"{BASE_URL}/api/listings?category=stay&limit=1")
        if listings_response.status_code != 200 or not listings_response.json().get("listings"):
            pytest.skip("No stay listings available for booking test")
        
        listing = listings_response.json()["listings"][0]
        listing_id = listing["id"]
        
        # Create booking
        response = requests.post(
            f"{BASE_URL}/api/bookings",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "listing_id": listing_id,
                "booking_date": "2026-04-01",
                "guests": 2,
                "notes": "TEST booking"
            }
        )
        
        assert response.status_code == 200, f"Failed to create booking: {response.text}"
        data = response.json()
        
        assert "booking_id" in data, "booking_id not found in response"
        print(f"SUCCESS: Booking created - booking_id: {data['booking_id']}")

    def test_get_user_bookings(self, auth_token):
        """Test getting user's bookings"""
        if not auth_token:
            pytest.skip("Auth token not available")
        
        response = requests.get(
            f"{BASE_URL}/api/bookings",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "bookings" in data
        print(f"SUCCESS: Get user bookings - found: {len(data['bookings'])}")


class TestCategoryPages:
    """Category pages and filter tests"""
    
    def test_home_category_listings(self):
        """Test Home category listings"""
        response = requests.get(f"{BASE_URL}/api/listings?category=home")
        assert response.status_code == 200
        data = response.json()
        print(f"SUCCESS: Home category - {len(data['listings'])} listings")

    def test_stay_category_listings(self):
        """Test Stay category listings"""
        response = requests.get(f"{BASE_URL}/api/listings?category=stay")
        assert response.status_code == 200
        data = response.json()
        print(f"SUCCESS: Stay category - {len(data['listings'])} listings")

    def test_event_category_listings(self):
        """Test Event category listings"""
        response = requests.get(f"{BASE_URL}/api/listings?category=event")
        assert response.status_code == 200
        data = response.json()
        print(f"SUCCESS: Event category - {len(data['listings'])} listings")

    def test_services_category_listings(self):
        """Test Services category listings"""
        response = requests.get(f"{BASE_URL}/api/listings?category=services")
        assert response.status_code == 200
        data = response.json()
        print(f"SUCCESS: Services category - {len(data['listings'])} listings")

    def test_business_category_listings(self):
        """Test Business category listings"""
        response = requests.get(f"{BASE_URL}/api/listings?category=business")
        assert response.status_code == 200
        data = response.json()
        print(f"SUCCESS: Business category - {len(data['listings'])} listings")

    def test_listings_with_city_filter(self):
        """Test listings with city filter"""
        response = requests.get(f"{BASE_URL}/api/listings?city=Surat")
        assert response.status_code == 200
        data = response.json()
        print(f"SUCCESS: Surat city filter - {len(data['listings'])} listings")

    def test_listings_with_price_filter(self):
        """Test listings with price range filter"""
        response = requests.get(f"{BASE_URL}/api/listings?min_price=1000&max_price=50000")
        assert response.status_code == 200
        data = response.json()
        print(f"SUCCESS: Price filter - {len(data['listings'])} listings")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
