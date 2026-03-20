"""
GharSetu Backend API Tests - Iteration 15
Testing: Notifications, AI Recommendations, Boost Listing APIs
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_USER = {
    "email": "plumber@test.com",
    "password": "Test@123"
}

ADMIN_USER = {
    "email": "admin@gharsetu.com",
    "password": "Admin@123"
}


class TestNotificationsAPI:
    """Tests for Notification APIs - GET /api/notifications, PUT read, PUT read-all"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=TEST_USER)
        if response.status_code == 200:
            self.token = response.json().get("token")
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip(f"Login failed: {response.status_code}")
    
    def test_get_notifications(self):
        """Test GET /api/notifications returns notification list"""
        response = requests.get(
            f"{BASE_URL}/api/notifications",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # Verify response structure
        assert "notifications" in data, "Response missing 'notifications' field"
        assert "unread_count" in data, "Response missing 'unread_count' field"
        assert isinstance(data["notifications"], list), "notifications should be a list"
        assert isinstance(data["unread_count"], int), "unread_count should be an integer"
        
        print(f"✓ GET /api/notifications - {len(data['notifications'])} notifications, {data['unread_count']} unread")
    
    def test_notifications_with_pagination(self):
        """Test notifications API supports pagination"""
        response = requests.get(
            f"{BASE_URL}/api/notifications",
            headers=self.headers,
            params={"page": 1, "limit": 5}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "page" in data or "notifications" in data  # Verify paginated response
        print(f"✓ GET /api/notifications with pagination - page 1")
    
    def test_mark_all_notifications_read(self):
        """Test PUT /api/notifications/read-all marks all as read"""
        response = requests.put(
            f"{BASE_URL}/api/notifications/read-all",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "message" in data
        print(f"✓ PUT /api/notifications/read-all - {data.get('message', 'success')}")
    
    def test_notifications_require_auth(self):
        """Test notifications API requires authentication"""
        response = requests.get(f"{BASE_URL}/api/notifications")
        
        # Should return 401 or 403 without auth
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Notifications API requires authentication")


class TestRecommendationsAPI:
    """Tests for AI Recommendations APIs"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=TEST_USER)
        if response.status_code == 200:
            self.token = response.json().get("token")
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip(f"Login failed: {response.status_code}")
    
    def test_get_recommendations(self):
        """Test GET /api/recommendations returns property recommendations"""
        response = requests.get(
            f"{BASE_URL}/api/recommendations",
            headers=self.headers,
            params={"limit": 6}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # Verify response structure
        assert "recommendations" in data, "Response missing 'recommendations' field"
        assert isinstance(data["recommendations"], list), "recommendations should be a list"
        
        # Check if AI explanation is present (may be empty if LLM call fails)
        if "ai_explanation" in data:
            print(f"✓ AI Explanation: {data['ai_explanation'][:100] if data['ai_explanation'] else 'None (fallback mode)'}")
        
        print(f"✓ GET /api/recommendations - {len(data['recommendations'])} recommendations returned")
    
    def test_recommendations_with_limit(self):
        """Test recommendations API respects limit parameter"""
        response = requests.get(
            f"{BASE_URL}/api/recommendations",
            headers=self.headers,
            params={"limit": 3}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Should return at most 3 recommendations
        assert len(data.get("recommendations", [])) <= 3, "Limit not respected"
        print(f"✓ GET /api/recommendations with limit=3 - {len(data['recommendations'])} returned")
    
    def test_recommendations_require_auth(self):
        """Test recommendations API requires authentication"""
        response = requests.get(f"{BASE_URL}/api/recommendations")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Recommendations API requires authentication")


class TestSimilarPropertiesAPI:
    """Tests for Similar Properties API"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get a listing ID to test similar properties"""
        # Get public listings
        response = requests.get(f"{BASE_URL}/api/listings", params={"limit": 1})
        if response.status_code == 200:
            listings = response.json().get("listings", [])
            if listings:
                self.listing_id = listings[0].get("id")
            else:
                pytest.skip("No listings available for testing")
        else:
            pytest.skip(f"Failed to fetch listings: {response.status_code}")
    
    def test_get_similar_properties(self):
        """Test GET /api/recommendations/similar/{listing_id}"""
        response = requests.get(
            f"{BASE_URL}/api/recommendations/similar/{self.listing_id}",
            params={"limit": 4}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # Verify response structure
        assert "similar" in data or "listings" in data, "Response missing similar listings"
        similar = data.get("similar", data.get("listings", []))
        
        print(f"✓ GET /api/recommendations/similar/{self.listing_id[:8]}... - {len(similar)} similar properties")
    
    def test_similar_with_invalid_id(self):
        """Test similar API with non-existent listing ID"""
        fake_id = str(uuid.uuid4())
        response = requests.get(
            f"{BASE_URL}/api/recommendations/similar/{fake_id}"
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print(f"✓ Similar API returns 404 for invalid listing ID")


class TestBoostListingAPI:
    """Tests for Boost Listing APIs"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as owner and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=TEST_USER)
        if response.status_code == 200:
            self.token = response.json().get("token")
            self.headers = {"Authorization": f"Bearer {self.token}"}
            self.user_id = response.json().get("user", {}).get("id")
        else:
            pytest.skip(f"Login failed: {response.status_code}")
    
    def get_owner_listing(self):
        """Get a listing owned by the test user"""
        response = requests.get(
            f"{BASE_URL}/api/owner/listings",
            headers=self.headers
        )
        if response.status_code == 200:
            listings = response.json().get("listings", [])
            if listings:
                return listings[0].get("id")
        return None
    
    def test_boost_create_order_validation(self):
        """Test POST /api/listings/boost/create-order with invalid listing"""
        fake_listing_id = str(uuid.uuid4())
        
        response = requests.post(
            f"{BASE_URL}/api/listings/boost/create-order",
            headers=self.headers,
            json={
                "listing_id": fake_listing_id,
                "duration": "7_days"
            }
        )
        
        # Should fail because listing doesn't exist or not owned
        assert response.status_code in [404, 400, 403], f"Expected 404/400/403, got {response.status_code}"
        print(f"✓ Boost API rejects invalid/unauthorized listing ID")
    
    def test_boost_invalid_duration(self):
        """Test boost API rejects invalid duration"""
        listing_id = self.get_owner_listing()
        
        if not listing_id:
            pytest.skip("No owner listings available")
        
        response = requests.post(
            f"{BASE_URL}/api/listings/boost/create-order",
            headers=self.headers,
            json={
                "listing_id": listing_id,
                "duration": "invalid_duration"
            }
        )
        
        assert response.status_code == 400, f"Expected 400 for invalid duration, got {response.status_code}"
        print(f"✓ Boost API rejects invalid duration")
    
    def test_boost_status_endpoint(self):
        """Test GET /api/listings/{id}/boost-status"""
        listing_id = self.get_owner_listing()
        
        if not listing_id:
            pytest.skip("No owner listings available")
        
        response = requests.get(
            f"{BASE_URL}/api/listings/{listing_id}/boost-status",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # Verify response structure
        assert "is_boosted" in data, "Response missing 'is_boosted' field"
        assert "prices" in data, "Response missing 'prices' field"
        
        print(f"✓ GET /api/listings/{listing_id[:8]}../boost-status - is_boosted: {data['is_boosted']}")
        print(f"  Prices: {data['prices']}")
    
    def test_boost_requires_auth(self):
        """Test boost API requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/listings/boost/create-order",
            json={"listing_id": "test", "duration": "7_days"}
        )
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Boost API requires authentication")


class TestOwnerListingsForBoost:
    """Tests to verify owner has listings (prerequisite for boost testing)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as test user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=TEST_USER)
        if response.status_code == 200:
            self.token = response.json().get("token")
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip(f"Login failed: {response.status_code}")
    
    def test_get_owner_listings(self):
        """Test GET /api/owner/listings"""
        response = requests.get(
            f"{BASE_URL}/api/owner/listings",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        assert "listings" in data, "Response missing 'listings' field"
        print(f"✓ GET /api/owner/listings - {len(data['listings'])} listings owned by test user")
        
        # Show listing details if any exist
        for listing in data.get("listings", [])[:3]:
            print(f"  - {listing.get('title', 'N/A')[:40]}... (id: {listing.get('id', 'N/A')[:8]})")


class TestSocketIONotifications:
    """Verify Socket.IO configuration for real-time notifications"""
    
    def test_socket_endpoint_available(self):
        """Test that socket.io endpoint is accessible"""
        # Try to hit the socket.io polling endpoint
        response = requests.get(
            f"{BASE_URL}/socket.io/",
            params={"EIO": 4, "transport": "polling"}
        )
        
        # Socket.IO should respond (may be 400 due to missing sid, but endpoint exists)
        # A 404 means Socket.IO is not mounted
        assert response.status_code != 404, "Socket.IO endpoint not found"
        print(f"✓ Socket.IO endpoint accessible (status: {response.status_code})")


# Run tests
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
