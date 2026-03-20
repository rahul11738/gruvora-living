"""
GharSetu API Tests - Comprehensive Backend Testing
Tests: Auth, Listings, Videos/Reels, Chat, Categories
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://gharsetu-hub.preview.emergentagent.com')


class TestHealthAndCategories:
    """Health check and categories API tests"""

    def test_health_endpoint(self):
        """Test health endpoint returns healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "version" in data
        print(f"SUCCESS: Health endpoint - status: {data['status']}, version: {data['version']}")

    def test_categories_endpoint(self):
        """Test categories endpoint returns all 5 categories"""
        response = requests.get(f"{BASE_URL}/api/categories")
        assert response.status_code == 200
        data = response.json()
        assert "categories" in data
        assert len(data["categories"]) == 5
        
        category_ids = [cat["id"] for cat in data["categories"]]
        expected = ["home", "business", "stay", "event", "services"]
        for cat in expected:
            assert cat in category_ids, f"Category {cat} not found"
        print(f"SUCCESS: Categories endpoint - found all 5 categories: {category_ids}")


class TestAuth:
    """Authentication endpoint tests"""
    
    @pytest.fixture(scope="class")
    def test_user(self):
        """Create a test user and return credentials"""
        unique_id = str(uuid.uuid4())[:8]
        email = f"TEST_user_{unique_id}@test.com"
        password = "testpass123"
        
        # Register user
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "name": f"TEST User {unique_id}",
            "email": email,
            "phone": "9876543210",
            "password": password,
            "gender": "male",
            "address": "Test Address",
            "city": "Surat"
        })
        
        if response.status_code == 200:
            data = response.json()
            return {
                "email": email,
                "password": password,
                "token": data["token"],
                "user_id": data["user"]["id"]
            }
        return None

    def test_user_registration(self):
        """Test user registration endpoint"""
        unique_id = str(uuid.uuid4())[:8]
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "name": f"TEST User {unique_id}",
            "email": f"TEST_reg_{unique_id}@test.com",
            "phone": "9876543210",
            "password": "testpass123",
            "gender": "male",
            "address": "Test Address",
            "city": "Surat"
        })
        
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["role"] == "user"
        print(f"SUCCESS: User registration - user_id: {data['user']['id']}")

    def test_user_login(self, test_user):
        """Test user login endpoint"""
        if not test_user:
            pytest.skip("Test user not created")
        
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": test_user["email"],
            "password": test_user["password"]
        })
        
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        print(f"SUCCESS: User login - email: {test_user['email']}")

    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "nonexistent@test.com",
            "password": "wrongpass"
        })
        
        assert response.status_code == 401
        print("SUCCESS: Invalid login returns 401")

    def test_get_current_user(self, test_user):
        """Test get current user endpoint"""
        if not test_user:
            pytest.skip("Test user not created")
        
        response = requests.get(f"{BASE_URL}/api/auth/me", headers={
            "Authorization": f"Bearer {test_user['token']}"
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == test_user["email"]
        print(f"SUCCESS: Get current user - email: {data['email']}")


class TestListings:
    """Listings CRUD and search tests"""
    
    def test_get_listings(self):
        """Test get listings endpoint"""
        response = requests.get(f"{BASE_URL}/api/listings")
        assert response.status_code == 200
        data = response.json()
        assert "listings" in data
        assert "total" in data
        print(f"SUCCESS: Get listings - total: {data['total']}, fetched: {len(data['listings'])}")

    def test_get_listings_by_category(self):
        """Test get listings filtered by category"""
        for category in ["home", "business", "stay", "event", "services"]:
            response = requests.get(f"{BASE_URL}/api/listings", params={"category": category})
            assert response.status_code == 200
            data = response.json()
            # Verify all returned listings match the category
            for listing in data["listings"]:
                assert listing["category"] == category
            print(f"SUCCESS: Get listings by category '{category}' - found: {len(data['listings'])}")

    def test_get_trending_listings(self):
        """Test get trending listings endpoint"""
        response = requests.get(f"{BASE_URL}/api/listings/trending")
        assert response.status_code == 200
        data = response.json()
        assert "listings" in data
        print(f"SUCCESS: Trending listings - found: {len(data['listings'])}")

    def test_search_listings(self):
        """Test search listings with query"""
        response = requests.get(f"{BASE_URL}/api/listings", params={"search": "apartment"})
        assert response.status_code == 200
        data = response.json()
        assert "listings" in data
        print(f"SUCCESS: Search listings for 'apartment' - found: {len(data['listings'])}")


class TestVideosReels:
    """Video/Reels API tests"""
    
    def test_get_videos(self):
        """Test get videos endpoint"""
        response = requests.get(f"{BASE_URL}/api/videos")
        assert response.status_code == 200
        data = response.json()
        assert "videos" in data
        assert "total" in data
        print(f"SUCCESS: Get videos - total: {data['total']}, fetched: {len(data['videos'])}")

    def test_get_videos_pagination(self):
        """Test videos pagination"""
        response = requests.get(f"{BASE_URL}/api/videos", params={"page": 1, "limit": 5})
        assert response.status_code == 200
        data = response.json()
        assert "page" in data
        assert data["page"] == 1
        assert len(data["videos"]) <= 5
        print(f"SUCCESS: Videos pagination - page: {data['page']}, videos: {len(data['videos'])}")

    def test_get_videos_by_category(self):
        """Test get videos filtered by category"""
        response = requests.get(f"{BASE_URL}/api/videos", params={"category": "home"})
        assert response.status_code == 200
        data = response.json()
        assert "videos" in data
        for video in data["videos"]:
            assert video["category"] == "home"
        print(f"SUCCESS: Videos by category 'home' - found: {len(data['videos'])}")

    def test_record_video_view(self):
        """Test recording video view"""
        # First get a video
        videos_response = requests.get(f"{BASE_URL}/api/videos", params={"limit": 1})
        if videos_response.status_code == 200 and videos_response.json()["videos"]:
            video_id = videos_response.json()["videos"][0]["id"]
            
            response = requests.post(f"{BASE_URL}/api/videos/{video_id}/view")
            assert response.status_code == 200
            print(f"SUCCESS: Record video view for video_id: {video_id}")
        else:
            pytest.skip("No videos available to test")


class TestAIChatbot:
    """AI Chatbot API tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get auth token for chatbot tests"""
        unique_id = str(uuid.uuid4())[:8]
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "name": f"TEST Chatbot User {unique_id}",
            "email": f"TEST_chatbot_{unique_id}@test.com",
            "phone": "9876543210",
            "password": "testpass123",
            "gender": "male",
            "address": "Test Address",
            "city": "Surat"
        })
        
        if response.status_code == 200:
            return response.json()["token"]
        return None

    def test_chat_endpoint(self, auth_token):
        """Test AI chatbot responds to messages"""
        if not auth_token:
            pytest.skip("Auth token not available")
        
        response = requests.post(
            f"{BASE_URL}/api/chat",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"message": "Hello, what can you help me with?"},
            timeout=60
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "response" in data
        assert len(data["response"]) > 0
        print(f"SUCCESS: AI Chatbot responded with {len(data['response'])} characters")

    def test_chat_property_search(self, auth_token):
        """Test AI chatbot handles property search queries"""
        if not auth_token:
            pytest.skip("Auth token not available")
        
        response = requests.post(
            f"{BASE_URL}/api/chat",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"message": "Find me a 2 BHK flat in Surat"},
            timeout=60
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "response" in data
        assert len(data["response"]) > 0
        print(f"SUCCESS: AI Chatbot handled property search query")

    def test_chat_requires_auth(self):
        """Test chatbot requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/chat",
            json={"message": "Hello"}
        )
        
        # Should require authentication
        assert response.status_code in [401, 403]
        print("SUCCESS: Chatbot correctly requires authentication")


class TestMessages:
    """Messaging API tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get auth token for messaging tests"""
        unique_id = str(uuid.uuid4())[:8]
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "name": f"TEST Msg User {unique_id}",
            "email": f"TEST_msg_{unique_id}@test.com",
            "phone": "9876543210",
            "password": "testpass123",
            "gender": "male",
            "address": "Test Address",
            "city": "Surat"
        })
        
        if response.status_code == 200:
            return response.json()["token"]
        return None

    def test_get_conversations(self, auth_token):
        """Test get conversations endpoint"""
        if not auth_token:
            pytest.skip("Auth token not available")
        
        response = requests.get(
            f"{BASE_URL}/api/messages/conversations",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "conversations" in data
        print(f"SUCCESS: Get conversations - found: {len(data['conversations'])}")


class TestWishlist:
    """Wishlist API tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get auth token for wishlist tests"""
        unique_id = str(uuid.uuid4())[:8]
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "name": f"TEST Wishlist User {unique_id}",
            "email": f"TEST_wishlist_{unique_id}@test.com",
            "phone": "9876543210",
            "password": "testpass123",
            "gender": "male",
            "address": "Test Address",
            "city": "Surat"
        })
        
        if response.status_code == 200:
            return response.json()["token"]
        return None

    def test_get_wishlist(self, auth_token):
        """Test get wishlist endpoint"""
        if not auth_token:
            pytest.skip("Auth token not available")
        
        response = requests.get(
            f"{BASE_URL}/api/wishlist",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "listings" in data
        print(f"SUCCESS: Get wishlist - items: {len(data['listings'])}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
