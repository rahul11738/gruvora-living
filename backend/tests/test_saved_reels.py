"""
Test Saved Reels Feature - Voice Search Fix and Saved Reels
Tests the following:
1. /api/videos/saved - GET user's saved videos
2. /api/videos/{id}/save - POST save a video
3. /api/videos/{id}/save - DELETE unsave a video
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://gharsetu-hub.preview.emergentagent.com')

# Test credentials
TEST_EMAIL = "testuser123@test.com"
TEST_PASSWORD = "Test@123"


class TestSavedReelsAPI:
    """Test saved reels API endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup for each test - login and get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        
        if response.status_code == 200:
            data = response.json()
            self.token = data.get("token")
            self.user = data.get("user")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        else:
            pytest.skip(f"Login failed with status {response.status_code}: {response.text}")
    
    def test_01_login_success(self):
        """Test that login works with test credentials"""
        assert self.token is not None, "Should have received a token"
        assert self.user is not None, "Should have received user data"
        print(f"Logged in as: {self.user.get('email')}")
    
    def test_02_get_saved_videos(self):
        """Test GET /api/videos/saved returns user's saved videos"""
        response = self.session.get(f"{BASE_URL}/api/videos/saved")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "videos" in data, "Response should contain 'videos' key"
        assert isinstance(data["videos"], list), "Videos should be a list"
        
        print(f"User has {len(data['videos'])} saved videos")
        
        # If there are saved videos, check their structure
        if data["videos"]:
            video = data["videos"][0]
            assert "id" in video, "Video should have 'id'"
            assert "title" in video, "Video should have 'title'"
            print(f"First saved video: {video.get('title', 'Unknown')}")
    
    def test_03_get_available_videos(self):
        """Get list of all videos to find one to save"""
        response = self.session.get(f"{BASE_URL}/api/videos")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "videos" in data, "Response should contain 'videos' key"
        
        self.available_videos = data["videos"]
        print(f"Found {len(self.available_videos)} available videos")
        
        return data["videos"]
    
    def test_04_save_video(self):
        """Test POST /api/videos/{id}/save to save a video"""
        # First get available videos
        videos_response = self.session.get(f"{BASE_URL}/api/videos")
        videos = videos_response.json().get("videos", [])
        
        if not videos:
            pytest.skip("No videos available to test save functionality")
        
        # Use the first video
        video_id = videos[0]["id"]
        print(f"Attempting to save video: {video_id}")
        
        response = self.session.post(f"{BASE_URL}/api/videos/{video_id}/save")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "message" in data, "Response should contain 'message'"
        print(f"Save response: {data.get('message')}")
        
        # Verify the video appears in saved list
        saved_response = self.session.get(f"{BASE_URL}/api/videos/saved")
        saved_data = saved_response.json()
        
        saved_ids = [v["id"] for v in saved_data.get("videos", [])]
        assert video_id in saved_ids, f"Video {video_id} should appear in saved list"
        print(f"Verified: Video {video_id} is now in saved list")
    
    def test_05_unsave_video(self):
        """Test DELETE /api/videos/{id}/save to unsave a video"""
        # First get saved videos
        saved_response = self.session.get(f"{BASE_URL}/api/videos/saved")
        saved_videos = saved_response.json().get("videos", [])
        
        if not saved_videos:
            pytest.skip("No saved videos to test unsave functionality")
        
        # Use the first saved video
        video_id = saved_videos[0]["id"]
        print(f"Attempting to unsave video: {video_id}")
        
        response = self.session.delete(f"{BASE_URL}/api/videos/{video_id}/save")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "message" in data, "Response should contain 'message'"
        print(f"Unsave response: {data.get('message')}")
        
        # Verify the video no longer appears in saved list
        saved_after_response = self.session.get(f"{BASE_URL}/api/videos/saved")
        saved_after_data = saved_after_response.json()
        
        saved_ids_after = [v["id"] for v in saved_after_data.get("videos", [])]
        assert video_id not in saved_ids_after, f"Video {video_id} should NOT appear in saved list after unsave"
        print(f"Verified: Video {video_id} is no longer in saved list")
    
    def test_06_save_video_again_for_ui_test(self):
        """Save a video again for UI testing"""
        # First get available videos
        videos_response = self.session.get(f"{BASE_URL}/api/videos")
        videos = videos_response.json().get("videos", [])
        
        if not videos:
            pytest.skip("No videos available")
        
        # Save the first video
        video_id = videos[0]["id"]
        response = self.session.post(f"{BASE_URL}/api/videos/{video_id}/save")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print(f"Re-saved video {video_id} for UI testing")
    
    def test_07_auth_required_for_saved_videos(self):
        """Test that /api/videos/saved requires authentication"""
        # Create a new session without auth
        unauthenticated_session = requests.Session()
        
        response = unauthenticated_session.get(f"{BASE_URL}/api/videos/saved")
        
        # Should return 403 or 401 without auth
        assert response.status_code in [401, 403], \
            f"Expected 401 or 403 for unauthenticated request, got {response.status_code}"
        print(f"Correctly requires authentication: status {response.status_code}")
    
    def test_08_video_not_found(self):
        """Test saving a non-existent video"""
        fake_video_id = "non-existent-video-id-12345"
        
        response = self.session.post(f"{BASE_URL}/api/videos/{fake_video_id}/save")
        
        # Should return 404
        assert response.status_code == 404, \
            f"Expected 404 for non-existent video, got {response.status_code}"
        print(f"Correctly returns 404 for non-existent video")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
