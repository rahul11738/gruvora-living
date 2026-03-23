import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { authAPI, listingsAPI } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Header } from './Layout';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Switch } from './ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Badge } from './ui/badge';
import { toast } from 'sonner';
import {
  User,
  Shield,
  Lock,
  Bell,
  Building2,
  Save,
  Phone,
  Mail,
  MapPin,
  Image,
  IndianRupee,
} from 'lucide-react';

const tabs = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'account', label: 'Account', icon: Shield },
  { id: 'password', label: 'Password', icon: Lock },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'listings', label: 'Listings', icon: Building2 },
];

export const SettingsPage = () => {
  const { user, refreshUser, isOwner } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [saving, setSaving] = useState(false);
  const [loadingListings, setLoadingListings] = useState(false);
  const [ownedListings, setOwnedListings] = useState([]);

  const [profileForm, setProfileForm] = useState({
    name: '',
    phone: '',
    profile_image: '',
  });

  const [accountForm, setAccountForm] = useState({
    email: '',
    address: '',
    city: '',
    state: '',
  });

  const [notificationForm, setNotificationForm] = useState({
    notifications_enabled: true,
    auto_reply_enabled: false,
    auto_reply_message: '',
  });

  const [passwordForm, setPasswordForm] = useState({
    old_password: '',
    new_password: '',
    confirm_password: '',
  });

  useEffect(() => {
    if (!user) return;
    setProfileForm({
      name: user.name || '',
      phone: user.phone || '',
      profile_image: user.profile_image || '',
    });
    setAccountForm({
      email: user.email || '',
      address: user.address || '',
      city: user.city || '',
      state: user.state || '',
    });
    setNotificationForm({
      notifications_enabled: typeof user.notifications_enabled === 'boolean' ? user.notifications_enabled : true,
      auto_reply_enabled: Boolean(user.auto_reply_enabled),
      auto_reply_message: user.auto_reply_message || '',
    });
  }, [user]);

  const loadOwnerListings = useCallback(async () => {
    if (!isOwner || !user?.id) return;
    setLoadingListings(true);
    try {
      const response = await listingsAPI.getAll({ owner_id: user.id, limit: 50 });
      setOwnedListings(response?.data?.listings || []);
    } catch {
      toast.error('Failed to load listings');
    } finally {
      setLoadingListings(false);
    }
  }, [isOwner, user?.id]);

  useEffect(() => {
    if (activeTab !== 'listings') return;
    loadOwnerListings();
  }, [activeTab, loadOwnerListings]);

  const handleProfileSave = useCallback(async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await authAPI.updateProfile(profileForm);
      await refreshUser();
      toast.success('Profile updated successfully');
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  }, [profileForm, refreshUser]);

  const handleAccountSave = useCallback(async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await authAPI.updateProfile(accountForm);
      await refreshUser();
      toast.success('Account settings updated');
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Failed to update account settings');
    } finally {
      setSaving(false);
    }
  }, [accountForm, refreshUser]);

  const handleNotificationSave = useCallback(async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await authAPI.updateProfile(notificationForm);
      await refreshUser();
      toast.success('Notification preferences saved');
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Failed to save notification preferences');
    } finally {
      setSaving(false);
    }
  }, [notificationForm, refreshUser]);

  const handlePasswordSave = useCallback(async (e) => {
    e.preventDefault();
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      toast.error('New password and confirmation do not match');
      return;
    }

    setSaving(true);
    try {
      await authAPI.changePassword({
        old_password: passwordForm.old_password,
        new_password: passwordForm.new_password,
      });
      setPasswordForm({ old_password: '', new_password: '', confirm_password: '' });
      toast.success('Password changed successfully');
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  }, [passwordForm]);

  const visibleTabs = useMemo(() => (isOwner ? tabs : tabs.filter((item) => item.id !== 'listings')), [isOwner]);

  return (
    <div className="min-h-screen bg-stone-50" data-testid="settings-page">
      <Header />
      <div className="container-main py-8">
        <div className="mb-6">
          <h1 className="font-heading text-3xl font-bold text-stone-900">Settings</h1>
          <p className="text-muted-foreground mt-1">Manage your profile, security, notifications, and account preferences.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <aside className="lg:col-span-1">
            <Card>
              <CardContent className="p-3">
                <div className="space-y-1">
                  {visibleTabs.map((tab) => {
                    const Icon = tab.icon;
                    const active = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                        className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                          active ? 'bg-primary text-white' : 'hover:bg-stone-100 text-stone-700'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="text-sm font-medium">{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </aside>

          <section className="lg:col-span-3">
            {activeTab === 'profile' && (
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
                      <label className="text-sm font-medium mb-1 block">Profile Image URL</label>
                      <Input
                        value={profileForm.profile_image}
                        onChange={(e) => setProfileForm((prev) => ({ ...prev, profile_image: e.target.value }))}
                        placeholder="https://..."
                      />
                      {profileForm.profile_image ? (
                        <img
                          src={profileForm.profile_image}
                          alt="Profile preview"
                          className="w-24 h-24 rounded-full object-cover mt-3 border"
                          onError={(event) => {
                            event.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : null}
                    </div>

                    <Button type="submit" disabled={saving} className="gap-2">
                      <Save className="w-4 h-4" />
                      {saving ? 'Saving...' : 'Save Profile'}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}

            {activeTab === 'account' && (
              <Card>
                <CardHeader>
                  <CardTitle>Account</CardTitle>
                  <CardDescription>Manage your account identity and address details.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleAccountSave} className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-1 block">Email</label>
                      <Input
                        type="email"
                        value={accountForm.email}
                        onChange={(e) => setAccountForm((prev) => ({ ...prev, email: e.target.value }))}
                        placeholder="name@example.com"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-1 block">Address</label>
                      <Textarea
                        value={accountForm.address}
                        onChange={(e) => setAccountForm((prev) => ({ ...prev, address: e.target.value }))}
                        placeholder="Street, area, landmark"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium mb-1 block">City</label>
                        <Input
                          value={accountForm.city}
                          onChange={(e) => setAccountForm((prev) => ({ ...prev, city: e.target.value }))}
                          placeholder="City"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1 block">State</label>
                        <Input
                          value={accountForm.state}
                          onChange={(e) => setAccountForm((prev) => ({ ...prev, state: e.target.value }))}
                          placeholder="State"
                        />
                      </div>
                    </div>

                    <Button type="submit" disabled={saving} className="gap-2">
                      <Save className="w-4 h-4" />
                      {saving ? 'Saving...' : 'Save Account'}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}

            {activeTab === 'password' && (
              <Card>
                <CardHeader>
                  <CardTitle>Password</CardTitle>
                  <CardDescription>Change your password with strong security requirements.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handlePasswordSave} className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-1 block">Current Password</label>
                      <Input
                        type="password"
                        value={passwordForm.old_password}
                        onChange={(e) => setPasswordForm((prev) => ({ ...prev, old_password: e.target.value }))}
                        placeholder="Current password"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">New Password</label>
                      <Input
                        type="password"
                        value={passwordForm.new_password}
                        onChange={(e) => setPasswordForm((prev) => ({ ...prev, new_password: e.target.value }))}
                        placeholder="Minimum 8 chars, 1 uppercase, 1 number"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">Confirm New Password</label>
                      <Input
                        type="password"
                        value={passwordForm.confirm_password}
                        onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirm_password: e.target.value }))}
                        placeholder="Confirm new password"
                        required
                      />
                    </div>
                    <Button type="submit" disabled={saving} className="gap-2">
                      <Lock className="w-4 h-4" />
                      {saving ? 'Saving...' : 'Change Password'}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}

            {activeTab === 'notifications' && (
              <Card>
                <CardHeader>
                  <CardTitle>Notifications</CardTitle>
                  <CardDescription>Control alerts and automated chat replies.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleNotificationSave} className="space-y-5">
                    <div className="flex items-center justify-between border rounded-lg p-4">
                      <div>
                        <p className="font-medium">Enable Notifications</p>
                        <p className="text-sm text-muted-foreground">Receive platform and chat notifications.</p>
                      </div>
                      <Switch
                        checked={notificationForm.notifications_enabled}
                        onCheckedChange={(value) =>
                          setNotificationForm((prev) => ({ ...prev, notifications_enabled: Boolean(value) }))
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between border rounded-lg p-4">
                      <div>
                        <p className="font-medium">Auto Reply</p>
                        <p className="text-sm text-muted-foreground">Send automated response when you are offline.</p>
                      </div>
                      <Switch
                        checked={notificationForm.auto_reply_enabled}
                        onCheckedChange={(value) =>
                          setNotificationForm((prev) => ({ ...prev, auto_reply_enabled: Boolean(value) }))
                        }
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-1 block">Auto Reply Message</label>
                      <Textarea
                        value={notificationForm.auto_reply_message}
                        onChange={(e) =>
                          setNotificationForm((prev) => ({ ...prev, auto_reply_message: e.target.value }))
                        }
                        placeholder="Thank you for your message. I will respond shortly."
                      />
                    </div>

                    <Button type="submit" disabled={saving} className="gap-2">
                      <Save className="w-4 h-4" />
                      {saving ? 'Saving...' : 'Save Preferences'}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}

            {activeTab === 'listings' && isOwner && (
              <Card>
                <CardHeader>
                  <CardTitle>Your Listings</CardTitle>
                  <CardDescription>Quick owner view of your active properties and pricing.</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingListings ? (
                    <p className="text-muted-foreground">Loading listings...</p>
                  ) : ownedListings.length === 0 ? (
                    <div className="space-y-3">
                      <p className="text-muted-foreground">No listings found yet.</p>
                      <Link to="/owner/dashboard?openCreate=1">
                        <Button>Create Your First Listing</Button>
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {ownedListings.map((listing) => (
                        <div
                          key={listing.id}
                          className="border rounded-lg p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                        >
                          <div>
                            <p className="font-medium text-stone-900">{listing.title}</p>
                            <p className="text-sm text-muted-foreground">{listing.location}, {listing.city}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge className="capitalize">{listing.status || 'pending'}</Badge>
                            <p className="font-semibold text-primary">
                              ₹{Number(listing.price || 0).toLocaleString('en-IN')}
                            </p>
                            <Link to={`/listing/${listing.id}`} className="inline-block">
                              <span className="inline-flex items-center justify-center px-3 py-1 text-sm font-medium border rounded-md border-input shadow-sm hover:bg-accent hover:text-accent-foreground transition-colors">View</span>
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
