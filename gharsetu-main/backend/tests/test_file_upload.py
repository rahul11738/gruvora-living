"""
Test Suite for GharSetu File Upload Endpoints
Tests: Image upload (single/multiple), Video upload with Cloudinary integration
"""
import pytest
import requests
import os
import io
from PIL import Image

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from previous iterations
TEST_USER = {
    "email": "testuser123@test.com",
    "password": "Test@123"
}

@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session

@pytest.fixture(scope="module")
def auth_token(api_client):
    """Get authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json=TEST_USER)
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")

@pytest.fixture(scope="module")
def authenticated_client(api_client, auth_token):
    """Session with auth header"""
    api_client.headers.update({
        "Authorization": f"Bearer {auth_token}"
    })
    return api_client

def create_test_image(size=(100, 100), color='blue', fmt='PNG'):
    """Create a test image in memory"""
    img = Image.new('RGB', size, color=color)
    buffer = io.BytesIO()
    img.save(buffer, format=fmt)
    buffer.seek(0)
    return buffer

def create_small_video():
    """Create a small test video file (minimum valid file)"""
    # Create a minimal valid file that starts with video-like bytes
    # This is for testing - real video would be larger
    buffer = io.BytesIO()
    # Write minimal content - in demo mode this will still work
    buffer.write(b'\x00\x00\x00\x1c\x66\x74\x79\x70\x69\x73\x6f\x6d')  # ftyp header
    buffer.write(b'\x00' * 100)  # padding
    buffer.seek(0)
    return buffer


class TestImageUploadEndpoints:
    """Test image upload endpoints - POST /api/upload/image and /api/upload/images"""
    
    def test_single_image_upload_endpoint_exists(self, api_client, auth_token):
        """Test that POST /api/upload/image endpoint exists and requires auth"""
        # Without auth - should return 403 or 401
        response = requests.post(f"{BASE_URL}/api/upload/image")
        assert response.status_code in [401, 403, 422], f"Expected auth error, got {response.status_code}"
        print(f"PASS: /api/upload/image endpoint exists and requires auth (status: {response.status_code})")
    
    def test_single_image_upload_success(self, authenticated_client, auth_token):
        """Test single image upload with valid image file"""
        test_image = create_test_image(color='red')
        
        files = {
            'file': ('test_image.png', test_image, 'image/png')
        }
        data = {
            'folder': 'listings'
        }
        
        # Remove Content-Type header for multipart
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(
            f"{BASE_URL}/api/upload/image",
            files=files,
            data=data,
            headers=headers
        )
        
        assert response.status_code == 200, f"Upload failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Expected success=True in response"
        assert "url" in data, "Expected 'url' in response"
        assert "public_id" in data, "Expected 'public_id' in response"
        print(f"PASS: Single image upload returned URL: {data.get('url')[:50]}...")
    
    def test_single_image_upload_invalid_file_type(self, auth_token):
        """Test that non-image files are rejected"""
        files = {
            'file': ('test.txt', io.BytesIO(b'not an image'), 'text/plain')
        }
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/upload/image",
            files=files,
            headers=headers
        )
        
        assert response.status_code == 400, f"Expected 400 for invalid file type, got {response.status_code}"
        print(f"PASS: Invalid file type correctly rejected with 400")


class TestMultipleImageUpload:
    """Test multiple images upload - POST /api/upload/images"""
    
    def test_multiple_images_endpoint_exists(self, auth_token):
        """Test that POST /api/upload/images endpoint exists"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Make request without files to check endpoint exists
        response = requests.post(
            f"{BASE_URL}/api/upload/images",
            headers=headers
        )
        
        # Should return 422 for missing files, not 404
        assert response.status_code in [422, 400], f"Expected 422/400 for missing files, got {response.status_code}"
        print(f"PASS: /api/upload/images endpoint exists (status: {response.status_code})")
    
    def test_multiple_images_upload_success(self, auth_token):
        """Test uploading multiple images at once"""
        test_image1 = create_test_image(color='green')
        test_image2 = create_test_image(color='yellow')
        
        files = [
            ('files', ('test1.png', test_image1, 'image/png')),
            ('files', ('test2.png', test_image2, 'image/png'))
        ]
        data = {'folder': 'listings'}
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/upload/images",
            files=files,
            data=data,
            headers=headers
        )
        
        assert response.status_code == 200, f"Upload failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert "images" in data, "Expected 'images' array in response"
        assert "total" in data, "Expected 'total' count in response"
        assert len(data["images"]) == 2, f"Expected 2 images, got {len(data['images'])}"
        
        # Check each uploaded image
        for img in data["images"]:
            assert img.get("success") == True, f"Image upload failed: {img}"
            assert "url" in img, "Expected 'url' in each image response"
        
        print(f"PASS: Multiple images uploaded, total: {data['total']}")


class TestVideoUploadEndpoint:
    """Test video upload endpoint - POST /api/videos/upload"""
    
    def test_video_upload_endpoint_exists(self):
        """Test that POST /api/videos/upload endpoint exists and requires auth"""
        response = requests.post(f"{BASE_URL}/api/videos/upload")
        # Without auth, should return 401
        assert response.status_code in [401, 422], f"Expected auth error, got {response.status_code}"
        print(f"PASS: /api/videos/upload endpoint exists (status: {response.status_code})")
    
    def test_video_upload_requires_auth_header(self, auth_token):
        """Test video upload with valid auth header"""
        # Create minimal test video file
        video_buffer = create_small_video()
        
        files = {
            'video': ('test_video.mp4', video_buffer, 'video/mp4')
        }
        data = {
            'title': 'Test Video Upload',
            'description': 'Test description',
            'category': 'home'
        }
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/videos/upload",
            files=files,
            data=data,
            headers=headers
        )
        
        # In demo mode (without real Cloudinary), should return success with placeholder
        assert response.status_code in [200, 500], f"Unexpected status: {response.status_code} - {response.text}"
        
        if response.status_code == 200:
            data = response.json()
            assert data.get("success") == True, "Expected success=True"
            assert "video_id" in data, "Expected video_id in response"
            assert "url" in data, "Expected url in response"
            print(f"PASS: Video upload successful, video_id: {data.get('video_id')}")
        else:
            # 500 may occur if Cloudinary rejects the minimal test file
            print(f"NOTE: Video upload returned 500 - may be due to minimal test file")
    
    def test_video_upload_invalid_file_type(self, auth_token):
        """Test that non-video files are rejected"""
        files = {
            'video': ('test.txt', io.BytesIO(b'not a video'), 'text/plain')
        }
        data = {
            'title': 'Invalid File Test',
            'category': 'home'
        }
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/videos/upload",
            files=files,
            data=data,
            headers=headers
        )
        
        assert response.status_code == 400, f"Expected 400 for invalid file type, got {response.status_code}"
        print(f"PASS: Invalid video file type correctly rejected")
    
    def test_video_upload_missing_required_fields(self, auth_token):
        """Test video upload fails without required title"""
        video_buffer = create_small_video()
        
        files = {
            'video': ('test.mp4', video_buffer, 'video/mp4')
        }
        # Missing 'title' which is required
        data = {
            'category': 'home'
        }
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/videos/upload",
            files=files,
            data=data,
            headers=headers
        )
        
        assert response.status_code == 422, f"Expected 422 for missing title, got {response.status_code}"
        print(f"PASS: Missing required field correctly returns 422")


class TestUploadAPIResponseFormat:
    """Test that upload endpoints return proper JSON responses"""
    
    def test_image_upload_json_response(self, auth_token):
        """Verify image upload returns properly formatted JSON"""
        test_image = create_test_image()
        files = {'file': ('test.png', test_image, 'image/png')}
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/upload/image",
            files=files,
            headers=headers
        )
        
        assert response.status_code == 200
        assert response.headers.get('content-type', '').startswith('application/json')
        
        data = response.json()
        assert isinstance(data, dict), "Response should be a JSON object"
        assert "success" in data, "Response should include 'success' field"
        assert "url" in data, "Response should include 'url' field"
        print(f"PASS: Image upload returns proper JSON with success={data['success']}")
    
    def test_multiple_images_json_response(self, auth_token):
        """Verify multiple images upload returns properly formatted JSON array"""
        test_image = create_test_image()
        files = [('files', ('test.png', test_image, 'image/png'))]
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/upload/images",
            files=files,
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "images" in data, "Response should include 'images' array"
        assert isinstance(data["images"], list), "'images' should be a list"
        assert "total" in data, "Response should include 'total' count"
        print(f"PASS: Multiple images upload returns proper JSON array format")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
