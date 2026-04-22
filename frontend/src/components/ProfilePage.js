import React, { useCallback, useEffect, useRef, useState } from 'react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Header } from './Layout';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { toast } from 'sonner';
import { Save, Image, Loader2 } from 'lucide-react';
import OptimizedImage from './OptimizedImage';

export default function ProfilePage() {
  const [saving, setSaving] = useState(false);
  const [selectedProfileImageFile, setSelectedProfileImageFile] = useState(null);
  const [selectedProfileImagePreview, setSelectedProfileImagePreview] = useState('');
  const [uploadingProfileImage, setUploadingProfileImage] = useState(false);
  const profileImageInputRef = useRef(null);
  const isUpdatingProfileImageRef = useRef(false);

  const [profileForm, setProfileForm] = useState({
    name: '',
    phone: '',
    profile_image: '',
  });

  useEffect(() => {
    if (!user || isUpdatingProfileImageRef.current) return;
    const cachedProfileImage = localStorage.getItem('gharsetu_profile_image') || '';
    setProfileForm({
      name: user.name || '',
      phone: user.phone || '',
      profile_image: user.profile_image || cachedProfileImage,
    });
  }, [user]);

  useEffect(() => {
    return () => {
      if (selectedProfileImagePreview) {
        URL.revokeObjectURL(selectedProfileImagePreview);
      }
    };
  }, [selectedProfileImagePreview]);

  const uploadProfileImageToCloudinary = useCallback(async (file) => {
    const signedResponse = await api.post('/upload/signature', {
      folder: 'profile',
      resource_type: 'image',
    });

    const signed = signedResponse.data;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('api_key', signed.api_key);
    formData.append('timestamp', String(signed.timestamp));
    formData.append('signature', signed.signature);
    formData.append('folder', signed.folder);

    const endpoint = `https://api.cloudinary.com/v1_1/${signed.cloud_name}/${signed.resource_type}/upload`;
    const response = await fetch(endpoint, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData?.error?.message || 'Profile image upload failed');
    }

    const uploaded = await response.json();
    return uploaded.secure_url;
  }, []);

  const handleProfileImageFileChange = useCallback((event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file');
      event.target.value = '';
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image size must be 10MB or less');
      event.target.value = '';
      return;
    }

    if (selectedProfileImagePreview) {
      URL.revokeObjectURL(selectedProfileImagePreview);
    }

    const previewUrl = URL.createObjectURL(file);
    setSelectedProfileImageFile(file);
    setSelectedProfileImagePreview(previewUrl);
  }, [selectedProfileImagePreview]);

  const handleProfileImageUpload = useCallback(async () => {
    if (!selectedProfileImageFile) {
      toast.error('Select an image first');
      return;
    }

    setUploadingProfileImage(true);
    isUpdatingProfileImageRef.current = true;
    try {
      const uploadedUrl = await uploadProfileImageToCloudinary(selectedProfileImageFile);
      const imageUrl = `${uploadedUrl}${uploadedUrl.includes('?') ? '&' : '?'}v=${Date.now()}`;

      setProfileForm((prev) => ({ ...prev, profile_image: imageUrl }));
      localStorage.setItem('gharsetu_profile_image', imageUrl);

      await updateProfile({ profile_image: imageUrl });
      toast.success('Profile image updated');

      if (selectedProfileImagePreview) {
        URL.revokeObjectURL(selectedProfileImagePreview);
      }
      setSelectedProfileImageFile(null);
      setSelectedProfileImagePreview('');
      if (profileImageInputRef.current) {
        profileImageInputRef.current.value = '';
      }
    } catch (error) {
      toast.error(error?.response?.data?.detail || error?.message || 'Failed to update profile image');
    } finally {
      setUploadingProfileImage(false);
      setTimeout(() => {
        isUpdatingProfileImageRef.current = false;
      }, 1000);
    }
  }, [selectedProfileImageFile, selectedProfileImagePreview, updateProfile, uploadProfileImageToCloudinary]);

  const handleProfileSave = useCallback(async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateProfile({
        name: profileForm.name,
        phone: profileForm.phone,
      });
      toast.success('Profile updated successfully');
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  }, [profileForm, updateProfile]);

  return (
    <div className="min-h-screen bg-stone-50 overflow-x-hidden" data-testid="profile-page">
      <Header />
      <div className="container-main py-6 md:py-8">
        <div className="mb-6">
          <h1 className="font-heading text-3xl font-bold text-stone-900">My Profile</h1>
          <p className="text-muted-foreground mt-1">Update your personal information and profile picture.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Update your public information and profile image.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleProfileSave} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Name</label>
                  <Input
                    value={profileForm.name}
                    onChange={(e) => setProfileForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Your full name"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Phone</label>
                  <Input
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm((prev) => ({ ...prev, phone: e.target.value }))}
                    placeholder="Phone number"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Profile Image</label>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <input
                    ref={profileImageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleProfileImageFileChange}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => profileImageInputRef.current?.click()}
                    className="gap-2"
                  >
                    <Image className="w-4 h-4" />
                    Select Photo
                  </Button>

                  <Button
                    type="button"
                    onClick={handleProfileImageUpload}
                    disabled={!selectedProfileImageFile || uploadingProfileImage}
                    className="gap-2"
                  >
                    {uploadingProfileImage ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Update Image
                      </>
                    )}
                  </Button>
                </div>

                <div className="mt-3">
                  {(selectedProfileImagePreview || profileForm.profile_image) ? (
                    <OptimizedImage
                      publicId={selectedProfileImagePreview || profileForm.profile_image}
                      alt="Profile preview"
                      className="w-24 h-24 rounded-full object-cover border"
                      width={96}
                      sizes="96px"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-full border border-dashed border-stone-300 flex items-center justify-center text-stone-400 text-xs">
                      No image
                    </div>
                  )}
                </div>
              </div>

              <Button type="submit" disabled={saving} className="gap-2">
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Profile
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
