import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { adminAPI } from '../lib/api';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from './ui/dialog';
import { toast } from 'sonner';
import {
  Users, FileText, Home, Building2, Hotel,
  PartyPopper, Wrench, Eye, CheckCircle, XCircle, Clock, Shield,
  LogOut, Loader2, Bell, Ban, Trash2,
  RotateCcw, Search, ChevronLeft, ChevronRight,
  AlertTriangle, Activity, BarChart3, Mail, Phone, MapPin,
} from 'lucide-react';

const CATEGORY_ICONS = {
  home: Home, business: Building2, stay: Hotel,
  event: PartyPopper, services: Wrench,
};
const OWNER_ROLE_LABELS = {
  property_owner: 'Property Owner', stay_owner: 'Stay Owner',
  service_provider: 'Service Provider', hotel_owner: 'Hotel Owner',
  event_owner: 'Event Owner',
};
const OWNER_ROLE_COLORS = {
  property_owner: 'bg-blue-100 text-blue-700',
  stay_owner: 'bg-purple-100 text-purple-700',
  service_provider: 'bg-orange-100 text-orange-700',
  hotel_owner: 'bg-pink-100 text-pink-700',
  event_owner: 'bg-green-100 text-green-700',
};

export const AdminDashboard = () => {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);

  const [users, setUsers] = useState([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersPage, setUsersPage] = useState(1);
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [blockStatusFilter, setBlockStatusFilter] = useState('');

  const [pendingOwners, setPendingOwners] = useState([]);
  const [pendingOwnersTotal, setPendingOwnersTotal] = useState(0);

  const [listings, setListings] = useState([]);
  const [listingsTotal, setListingsTotal] = useState(0);
  const [listingsPage, setListingsPage] = useState(1);
  const [listingStatusFilter, setListingStatusFilter] = useState('');
  const [pendingListings, setPendingListings] = useState([]);

  const [notifTarget, setNotifTarget] = useState('all');
  const [notifTitle, setNotifTitle] = useState('');
  const [notifMessage, setNotifMessage] = useState('');
  const [notifType, setNotifType] = useState('admin_message');
  const [sendingNotif, setSendingNotif] = useState(false);

  const [activityLogs, setActivityLogs] = useState([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsPage, setLogsPage] = useState(1);

  const [profileModal, setProfileModal] = useState(null);
  const [profileData, setProfileData] = useState(null);
  const [blockModal, setBlockModal] = useState(null);
  const [rejectModal, setRejectModal] = useState(null);

  useEffect(() => {
    if (!isAdmin) {
      toast.error('Admin access required');
      navigate('/');
      return;
    }
    fetchStats();
  }, [isAdmin, navigate]);

  const fetchStats = async () => {
    try {
      const res = await adminAPI.getStats();
      setStats(res.data);
    } catch {
      toast.error('Failed to load stats');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = useCallback(async (page = 1, search = userSearch, role = userRoleFilter, blockStatus = blockStatusFilter) => {
    try {
      const res = await adminAPI.getUsers({
        page, limit: 50,
        search: search || undefined,
        role: role || undefined,
        block_status: blockStatus || undefined,
      });
      setUsers(res.data.users || []);
      setUsersTotal(res.data.total || 0);
      setUsersPage(page);
    } catch {
      toast.error('Failed to load users');
    }
  }, [userSearch, userRoleFilter, blockStatusFilter]);

  const fetchPendingOwners = useCallback(async () => {
    try {
      const res = await adminAPI.getPendingOwners({ limit: 100 });
      setPendingOwners(res.data.owners || []);
      setPendingOwnersTotal(res.data.total || 0);
    } catch {
      toast.error('Failed to load pending owners');
    }
  }, []);

  const fetchListings = useCallback(async (page = 1, status = listingStatusFilter) => {
    try {
      const res = await adminAPI.getListings({
        page, limit: 50, status: status || undefined,
      });
      setListings(res.data.listings || []);
      setListingsTotal(res.data.total || 0);
      setListingsPage(page);
    } catch {
      toast.error('Failed to load listings');
    }
  }, [listingStatusFilter]);

  const fetchPendingListings = useCallback(async () => {
    try {
      const res = await adminAPI.getPendingListings({ limit: 100 });
      setPendingListings(res.data.listings || []);
    } catch {
      // intentionally silent
    }
  }, []);

  const fetchActivityLogs = useCallback(async (page = 1) => {
    try {
      const res = await adminAPI.getActivityLogs({ page, limit: 50 });
      setActivityLogs(res.data.logs || []);
      setLogsTotal(res.data.total || 0);
      setLogsPage(page);
    } catch {
      toast.error('Failed to load logs');
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'users') fetchUsers();
    if (activeTab === 'owners') fetchPendingOwners();
    if (activeTab === 'listings') {
      fetchListings();
      fetchPendingListings();
    }
    if (activeTab === 'logs') fetchActivityLogs();
  }, [activeTab, fetchUsers, fetchPendingOwners, fetchListings, fetchPendingListings, fetchActivityLogs]);

  const openProfile = async (userId) => {
    setProfileModal({ userId });
    setProfileData(null);
    try {
      const res = await adminAPI.getUserProfile(userId);
      setProfileData(res.data);
    } catch {
      toast.error('Failed to load profile');
    }
  };

  const handleVerifyEmail = async (userId) => {
    try {
      await adminAPI.verifyEmail(userId);
      toast.success('Email verified');
      setUsers((prev) => prev.map((u) => (u.id === userId
        ? { ...u, is_email_verified: true, is_verified: true } : u)));
    } catch {
      toast.error('Failed to verify email');
    }
  };

  const handleAadharVerify = async (ownerId, status, reason = '') => {
    try {
      await adminAPI.verifyOwnerAadhar(ownerId, { user_id: ownerId, status, rejection_reason: reason });
      toast.success(status === 'verified' ? 'Owner verified!' : 'Verification rejected');
      setPendingOwners((prev) => prev.filter((o) => o.id !== ownerId));
      setRejectModal(null);
      fetchStats();
    } catch {
      toast.error('Failed to update verification');
    }
  };

  const handleBlock = async ({ userId, blockType, reason, durationHours }) => {
    try {
      await adminAPI.blockUser(userId, {
        user_id: userId,
        block_type: blockType,
        reason,
        duration_hours: blockType === 'temporary' ? durationHours : undefined,
      });
      toast.success(`User ${blockType === 'temporary' ? 'temporarily' : 'permanently'} blocked`);
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, block_status: blockType } : u)));
      setBlockModal(null);
    } catch {
      toast.error('Failed to block user');
    }
  };

  const handleUnblock = async (userId) => {
    try {
      await adminAPI.unblockUser(userId);
      toast.success('User unblocked');
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, block_status: undefined } : u)));
    } catch {
      toast.error('Failed to unblock');
    }
  };

  const handleDeleteUser = async (userId, reason) => {
    if (!window.confirm(`Delete user? This is irreversible.\nReason: ${reason}`)) return;
    try {
      await adminAPI.deleteUser(userId, reason);
      toast.success('User deleted');
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch {
      toast.error('Failed to delete user');
    }
  };

  const handleListingAction = async (listingId, action, reason = '') => {
    try {
      if (action === 'remove') {
        await adminAPI.removeListing(listingId, reason || 'Removed by admin');
      } else {
        await adminAPI.updateListingStatusV2(listingId, action, reason || undefined);
      }
      toast.success(`Listing ${action}d`);
      setListings((prev) => prev.map((l) => (l.id === listingId ? { ...l, status: action === 'remove' ? 'rejected' : action } : l)));
      setPendingListings((prev) => prev.filter((l) => l.id !== listingId));
      fetchStats();
    } catch {
      toast.error('Failed to update listing');
    }
  };

  const handleSendNotification = async () => {
    if (!notifTitle.trim() || !notifMessage.trim()) {
      toast.error('Title and message required');
      return;
    }
    setSendingNotif(true);
    try {
      const res = await adminAPI.sendNotification({
        target: notifTarget,
        title: notifTitle,
        message: notifMessage,
        type: notifType,
      });
      toast.success(`Sent to ${res.data.recipients} recipients`);
      setNotifTitle('');
      setNotifMessage('');
    } catch {
      toast.error('Failed to send notification');
    } finally {
      setSendingNotif(false);
    }
  };

  const handleLogout = useCallback(() => {
    logout();
    navigate('/');
  }, [logout, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const TABS = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'users', label: 'Users', icon: Users, badge: stats?.total_users },
    { id: 'owners', label: 'Owner Requests', icon: Shield, badge: stats?.pending_aadhar, badgeColor: 'bg-red-500' },
    { id: 'listings', label: 'Listings', icon: FileText, badge: stats?.pending_listings, badgeColor: 'bg-yellow-500' },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'logs', label: 'Activity Logs', icon: Activity },
  ];

  return (
    <div className="min-h-screen bg-stone-100 flex" data-testid="admin-dashboard-v2">
      <aside className="w-64 bg-stone-900 text-white flex flex-col fixed h-screen z-40">
        <div className="p-6 border-b border-stone-700">
          <Link to="/" className="flex items-center gap-2">
            <img
              src="/GruvoraLogo.jpeg"
              alt="Gruvora"
              className="w-9 h-9 rounded-lg object-cover"
            />
            <div>
              <p className="font-bold text-sm">Gruvora</p>
              <p className="text-xs text-stone-400">Admin Panel</p>
            </div>
          </Link>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'bg-primary text-white'
                    : 'text-stone-400 hover:bg-stone-800 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1 text-left">{tab.label}</span>
                {tab.badge > 0 && (
                  <span className={`text-xs text-white rounded-full px-1.5 py-0.5 ${tab.badgeColor || 'bg-stone-600'}`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-stone-700">
          <p className="text-xs text-stone-400 truncate mb-2">{user?.email}</p>
          <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 text-stone-400 hover:text-red-400 text-sm rounded-lg hover:bg-stone-800 transition-colors">
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </aside>

      <main className="flex-1 ml-64 p-8 min-h-screen">
        {activeTab === 'overview' && (
          <OverviewTab
            stats={stats}
            onNavigate={setActiveTab}
            onNavigateWithFilter={(tab, filters = {}) => {
              setActiveTab(tab);
              if (filters.role !== undefined) {
                setUserRoleFilter(filters.role);
                setBlockStatusFilter('');
                fetchUsers(1, userSearch, filters.role, '');
              }
              if (filters.blockStatus !== undefined) {
                setBlockStatusFilter(filters.blockStatus);
                setUserRoleFilter('');
                fetchUsers(1, userSearch, '', filters.blockStatus);
              }
            }}
          />
        )}

        {activeTab === 'users' && (
          <UsersTab
            users={users}
            total={usersTotal}
            page={usersPage}
            search={userSearch}
            roleFilter={userRoleFilter}
            blockStatusFilter={blockStatusFilter}
            onSearch={(v) => { setUserSearch(v); fetchUsers(1, v, userRoleFilter, blockStatusFilter); }}
            onRoleFilter={(v) => { setUserRoleFilter(v); fetchUsers(1, userSearch, v, ''); }}
            onBlockStatusFilter={(v) => { setBlockStatusFilter(v); fetchUsers(1, userSearch, '', v); }}
            onPageChange={(p) => fetchUsers(p)}
            onVerifyEmail={handleVerifyEmail}
            onViewProfile={openProfile}
            onBlock={(u) => setBlockModal({ userId: u.id, userName: u.name })}
            onUnblock={handleUnblock}
            onDelete={(userId) => handleDeleteUser(userId, 'Removed by admin')}
          />
        )}

        {activeTab === 'owners' && (
          <OwnersTab
            owners={pendingOwners}
            total={pendingOwnersTotal}
            onVerify={(id) => handleAadharVerify(id, 'verified')}
            onReject={(owner) => setRejectModal({ ownerId: owner.id, ownerName: owner.name })}
            onViewProfile={openProfile}
          />
        )}

        {activeTab === 'listings' && (
          <ListingsTab
            listings={listings}
            pendingListings={pendingListings}
            total={listingsTotal}
            page={listingsPage}
            statusFilter={listingStatusFilter}
            onStatusFilter={(v) => { setListingStatusFilter(v); fetchListings(1, v); }}
            onPageChange={(p) => fetchListings(p)}
            onAction={handleListingAction}
          />
        )}

        {activeTab === 'notifications' && (
          <NotificationsTab
            target={notifTarget}
            title={notifTitle}
            message={notifMessage}
            type={notifType}
            sending={sendingNotif}
            onTargetChange={setNotifTarget}
            onTitleChange={setNotifTitle}
            onMessageChange={setNotifMessage}
            onTypeChange={setNotifType}
            onSend={handleSendNotification}
            stats={stats}
          />
        )}

        {activeTab === 'logs' && (
          <LogsTab
            logs={activityLogs}
            total={logsTotal}
            page={logsPage}
            onPageChange={fetchActivityLogs}
          />
        )}
      </main>

      <Dialog open={!!profileModal} onOpenChange={() => { setProfileModal(null); setProfileData(null); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>User Profile</DialogTitle>
          </DialogHeader>
          <ProfileModalContent data={profileData} onVerifyEmail={handleVerifyEmail} />
        </DialogContent>
      </Dialog>

      <BlockUserModal
        modal={blockModal}
        onClose={() => setBlockModal(null)}
        onBlock={handleBlock}
      />

      <RejectAadharModal
        modal={rejectModal}
        onClose={() => setRejectModal(null)}
        onReject={handleAadharVerify}
      />
    </div>
  );
};

const OverviewTab = ({ stats, onNavigate, onNavigateWithFilter }) => {
  if (!stats) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  const ownerTypes = stats.owner_type_breakdown || {};

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Dashboard Overview</h1>
        <p className="text-stone-500 text-sm mt-1">Real-time platform health</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Users', value: stats.total_users, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50', delta: stats.new_users_7d, tab: 'users' },
          { label: 'Total Owners', value: stats.total_owners, icon: Shield, color: 'text-green-600', bg: 'bg-green-50', delta: stats.new_owners_7d, tab: 'owners' },
          { label: 'Total Listings', value: stats.total_listings, icon: FileText, color: 'text-purple-600', bg: 'bg-purple-50', delta: stats.new_listings_7d, tab: 'listings' },
          { label: 'Pending Approvals', value: (stats.pending_listings || 0) + (stats.pending_aadhar || 0), icon: Clock, color: 'text-orange-600', bg: 'bg-orange-50', urgent: true },
        ].map(({ label, value, icon: Icon, color, bg, delta, urgent, tab }) => (
          <Card
            key={label}
            className={`cursor-pointer hover:shadow-md transition-shadow ${urgent && value > 0 ? 'ring-2 ring-orange-300' : ''}`}
            onClick={() => tab && onNavigate(tab)}
          >
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-stone-500 font-medium">{label}</p>
                  <p className="text-3xl font-bold text-stone-900 mt-1">{value?.toLocaleString()}</p>
                  {delta !== undefined && (
                    <p className="text-xs text-green-600 mt-1">+{delta} this week</p>
                  )}
                </div>
                <div className={`w-11 h-11 ${bg} rounded-xl flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Owner Types (5 categories)</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {Object.entries(OWNER_ROLE_LABELS).map(([role, label]) => (
              <div
                key={role}
                onClick={() => onNavigateWithFilter('users', { role })}
                className={`rounded-lg p-3 cursor-pointer hover:opacity-75 active:scale-95 transition-all ${OWNER_ROLE_COLORS[role] || 'bg-stone-100'}`}
                title={`Show ${label}s`}
              >
                <p className="text-xs font-medium">{label}</p>
                <p className="text-2xl font-bold mt-1">{ownerTypes[role] || 0}</p>
                <p className="text-xs opacity-70 mt-1">Click to filter →</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-yellow-500" />
              Pending Listing Approvals
              {(stats.pending_listings || 0) > 0 && (
                <Badge className="bg-yellow-100 text-yellow-700 ml-auto">{stats.pending_listings}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(stats.pending_listings || 0) === 0 ? (
              <p className="text-sm text-stone-400 text-center py-4">No pending listings</p>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-stone-600">{stats.pending_listings} listings awaiting approval</p>
                <Button size="sm" onClick={() => onNavigate('listings')} className="w-full mt-2">
                  Review Listings ?
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="w-4 h-4 text-red-500" />
              Pending Aadhar Verifications
              {(stats.pending_aadhar || 0) > 0 && (
                <Badge className="bg-red-100 text-red-700 ml-auto">{stats.pending_aadhar}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(stats.pending_aadhar || 0) === 0 ? (
              <p className="text-sm text-stone-400 text-center py-4">No pending verifications</p>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-stone-600">{stats.pending_aadhar} owner requests pending</p>
                <Button size="sm" onClick={() => onNavigate('owners')} className="w-full mt-2 bg-red-600 hover:bg-red-700">
                  Review Owners ?
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {stats.daily_growth?.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">7-Day Growth</CardTitle></CardHeader>
          <CardContent>
            <MiniBarChart data={stats.daily_growth} />
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: 'Email Verified', value: stats.email_verified || 0, color: 'text-green-600',
            onClick: () => onNavigateWithFilter('users', { role: 'user' }),
          },
          {
            label: 'Email Unverified', value: stats.email_unverified || 0, color: 'text-yellow-600',
            onClick: () => onNavigateWithFilter('users', { role: 'user' }),
          },
          {
            label: 'Blocked Users', value: (stats.blocked_temp || 0) + (stats.blocked_perm || 0), color: 'text-red-600',
            onClick: () => onNavigateWithFilter('users', { blockStatus: 'temporary' }),
          },
          {
            label: 'Verified Owners', value: stats.verified_owners || 0, color: 'text-blue-600',
            onClick: () => onNavigateWithFilter('users', { role: 'property_owner' }),
          },
        ].map(({ label, value, color, onClick }) => (
          <div
            key={label}
            onClick={onClick}
            className="bg-white rounded-xl border border-stone-200 p-4 cursor-pointer hover:shadow-md hover:border-stone-300 active:scale-95 transition-all"
          >
            <p className="text-xs text-stone-500">{label}</p>
            <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
            <p className="text-xs text-stone-400 mt-1">Click to view →</p>
          </div>
        ))}
      </div>
    </div>
  );
};

const UsersTab = ({ users, total, page, search, roleFilter, blockStatusFilter = '', onSearch, onRoleFilter, onBlockStatusFilter = () => {}, onPageChange,
  onVerifyEmail, onViewProfile, onBlock, onUnblock, onDelete }) => {
  const totalPages = Math.ceil(total / 50);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-stone-500 text-sm">{total.toLocaleString()} total</p>
        </div>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <Input
            placeholder="Search name, email, phone..."
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => { onRoleFilter(e.target.value); onBlockStatusFilter(''); }}
          className="h-9 rounded-md border border-stone-300 bg-white px-3 text-sm"
        >
          <option value="">All roles</option>
          <option value="user">User</option>
          <option value="property_owner">Property Owner</option>
          <option value="stay_owner">Stay Owner</option>
          <option value="service_provider">Service Provider</option>
          <option value="hotel_owner">Hotel Owner</option>
          <option value="event_owner">Event Owner</option>
        </select>
        <select
          value={blockStatusFilter}
          onChange={(e) => { onBlockStatusFilter(e.target.value); onRoleFilter(''); }}
          className="h-9 rounded-md border border-stone-300 bg-white px-3 text-sm"
        >
          <option value="">All status</option>
          <option value="temporary">Temp Blocked</option>
          <option value="permanent">Perm Blocked</option>
        </select>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-stone-50">
                  <th className="text-left p-4 font-medium text-stone-600">User</th>
                  <th className="text-left p-4 font-medium text-stone-600">Role</th>
                  <th className="text-left p-4 font-medium text-stone-600">Email</th>
                  <th className="text-left p-4 font-medium text-stone-600">Status</th>
                  <th className="text-left p-4 font-medium text-stone-600">Joined</th>
                  <th className="text-left p-4 font-medium text-stone-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12 text-stone-400">No users found</td></tr>
                ) : users.map((u) => (
                  <tr key={u.id} className="border-b hover:bg-stone-50 transition-colors">
                    <td className="p-4">
                      <div>
                        <p className="font-medium">{u.name}</p>
                        <p className="text-xs text-stone-400">{u.phone}</p>
                      </div>
                    </td>
                    <td className="p-4">
                      <Badge className={OWNER_ROLE_COLORS[u.role] || 'bg-blue-100 text-blue-700'}>
                        {OWNER_ROLE_LABELS[u.role] || u.role}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-stone-600 truncate max-w-36">{u.email}</span>
                        {u.is_email_verified
                          ? <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                          : <AlertTriangle className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0" />
                        }
                      </div>
                    </td>
                    <td className="p-4">
                      {u.block_status === 'permanent' && <Badge className="bg-red-100 text-red-700">Perm. Blocked</Badge>}
                      {u.block_status === 'temporary' && <Badge className="bg-orange-100 text-orange-700">Temp. Blocked</Badge>}
                      {!u.block_status && <Badge className="bg-green-100 text-green-700">Active</Badge>}
                    </td>
                    <td className="p-4 text-stone-400 text-xs">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString('en-IN') : '--'}
                    </td>
                    <td className="p-4">
                      <div className="flex gap-1 flex-wrap">
                        <Button size="icon" variant="ghost" title="View profile" onClick={() => onViewProfile(u.id)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        {!u.is_email_verified && (
                          <Button size="icon" variant="ghost" title="Verify email" onClick={() => onVerifyEmail(u.id)}>
                            <Mail className="w-4 h-4 text-blue-500" />
                          </Button>
                        )}
                        {u.block_status ? (
                          <Button size="icon" variant="ghost" title="Unblock" onClick={() => onUnblock(u.id)}>
                            <RotateCcw className="w-4 h-4 text-green-500" />
                          </Button>
                        ) : (
                          <Button size="icon" variant="ghost" title="Block" onClick={() => onBlock(u)}>
                            <Ban className="w-4 h-4 text-orange-500" />
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" title="Delete" onClick={() => onDelete(u.id)}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t">
              <p className="text-sm text-stone-500">Page {page} of {totalPages} - {total} total</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const OwnersTab = ({ owners, total, onVerify, onReject, onViewProfile }) => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-bold">Owner Verification Requests</h1>
      <p className="text-stone-500 text-sm">{total} pending Aadhar verifications</p>
    </div>

    {owners.length === 0 ? (
      <Card>
        <CardContent className="py-16 text-center">
          <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
          <p className="text-stone-500">No pending verification requests</p>
        </CardContent>
      </Card>
    ) : (
      <div className="space-y-4">
        {owners.map((owner) => (
          <Card key={owner.id}>
            <CardContent className="pt-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold">{owner.name}</h3>
                    <Badge className={OWNER_ROLE_COLORS[owner.role] || 'bg-gray-100 text-gray-700'}>
                      {OWNER_ROLE_LABELS[owner.role] || owner.role}
                    </Badge>
                    <Badge className="bg-yellow-100 text-yellow-700">Pending Aadhar</Badge>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-stone-600">
                    <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{owner.email}</span>
                    <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{owner.phone}</span>
                    <span className="flex items-center gap-1"><Shield className="w-3.5 h-3.5" />
                      Aadhar: ****{owner.aadhar_number?.slice(-4) || 'N/A'}
                    </span>
                    <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{owner.city}, {owner.state}</span>
                  </div>
                  {owner.aadhar_name && (
                    <p className="mt-1 text-sm text-stone-500">Aadhar name: {owner.aadhar_name}</p>
                  )}
                  {owner.business_name && (
                    <p className="text-sm text-stone-500">Business: {owner.business_name}</p>
                  )}
                  <p className="text-xs text-stone-400 mt-1">
                    Registered: {owner.created_at ? new Date(owner.created_at).toLocaleDateString('en-IN') : '--'}
                  </p>
                </div>
                <div className="flex flex-col gap-2 flex-shrink-0">
                  <Button size="sm" onClick={() => onViewProfile(owner.id)} variant="outline">
                    <Eye className="w-4 h-4 mr-1" /> Profile
                  </Button>
                  <Button size="sm" onClick={() => onVerify(owner.id)} className="bg-green-600 hover:bg-green-700">
                    <CheckCircle className="w-4 h-4 mr-1" /> Approve
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onReject(owner)} className="text-red-600 border-red-200 hover:bg-red-50">
                    <XCircle className="w-4 h-4 mr-1" /> Reject
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )}
  </div>
);

const ListingsTab = ({ listings, pendingListings, total, page, statusFilter, onStatusFilter, onPageChange, onAction }) => {
  const totalPages = Math.ceil(total / 50);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Listings</h1>
        <p className="text-stone-500 text-sm">{total.toLocaleString()} total - {pendingListings.length} pending</p>
      </div>

      {pendingListings.length > 0 && (
        <Card className="border-yellow-200">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-yellow-500" />
              Pending Approval Queue ({pendingListings.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingListings.slice(0, 10).map((l) => {
                const Icon = CATEGORY_ICONS[l.category] || FileText;
                return (
                  <div key={l.id} className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg">
                    <div className="w-14 h-14 rounded overflow-hidden flex-shrink-0">
                      <img src={l.images?.[0] || 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=200'}
                        alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <Icon className="w-3.5 h-3.5 text-stone-400" />
                        <p className="font-medium text-sm truncate">{l.title}</p>
                      </div>
                      <p className="text-xs text-stone-500">By {l.owner_name} - INR {l.price?.toLocaleString('en-IN')}</p>
                      {l.owner_info && (
                        <p className="text-xs text-stone-400">Owner: {l.owner_info.email}</p>
                      )}
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button size="sm" onClick={() => onAction(l.id, 'approved')} className="bg-green-600 hover:bg-green-700">
                        <CheckCircle className="w-3.5 h-3.5 mr-1" /> Approve
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => onAction(l.id, 'rejected')} className="text-red-600">
                        <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-3">
        <select
          value={statusFilter}
          onChange={(e) => onStatusFilter(e.target.value)}
          className="h-9 rounded-md border border-stone-300 bg-white px-3 text-sm"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {listings.length === 0 ? (
              <p className="text-center py-12 text-stone-400">No listings found</p>
            ) : listings.map((l) => {
              const Icon = CATEGORY_ICONS[l.category] || FileText;
              return (
                <div key={l.id} className="flex items-center gap-4 p-4 hover:bg-stone-50">
                  <div className="w-16 h-16 rounded overflow-hidden flex-shrink-0">
                    <img src={l.images?.[0] || 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=200'}
                      alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Icon className="w-3.5 h-3.5 text-stone-400" />
                      <span className="text-xs text-stone-400 capitalize">{l.category}</span>
                      <Badge className={
                        l.status === 'approved' ? 'bg-green-100 text-green-700' :
                        l.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }>{l.status}</Badge>
                    </div>
                    <p className="font-medium text-sm truncate mt-0.5">{l.title}</p>
                    <p className="text-xs text-stone-500">By {l.owner_name} - INR {l.price?.toLocaleString('en-IN')}</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    {l.status === 'pending' && (
                      <>
                        <Button size="sm" onClick={() => onAction(l.id, 'approved')} className="bg-green-600 hover:bg-green-700">
                          Approve
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => onAction(l.id, 'rejected')} className="text-red-600">
                          Reject
                        </Button>
                      </>
                    )}
                    {l.status === 'approved' && (
                      <Button size="sm" variant="outline" onClick={() => onAction(l.id, 'remove', 'Removed by admin')} className="text-red-600">
                        Remove
                      </Button>
                    )}
                    <Link to={`/listing/${l.id}`}>
                      <Button size="icon" variant="ghost"><Eye className="w-4 h-4" /></Button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t">
              <p className="text-sm text-stone-500">Page {page} of {totalPages}</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const NotificationsTab = ({ target, title, message, type, sending, onTargetChange,
  onTitleChange, onMessageChange, onTypeChange, onSend, stats }) => (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Send Notification</h1>
        <p className="text-stone-500 text-sm">Broadcast messages to users and owners</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total users', value: stats?.total_users || 0 },
          { label: 'Total owners', value: stats?.total_owners || 0 },
          { label: 'All combined', value: (stats?.total_users || 0) + (stats?.total_owners || 0) },
        ].map(({ label, value }) => (
          <div key={label} className="bg-stone-100 rounded-xl p-4">
            <p className="text-xs text-stone-500">{label}</p>
            <p className="text-xl font-bold mt-0.5">{value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-stone-700">Send to</label>
            <select
              value={target}
              onChange={(e) => onTargetChange(e.target.value)}
              className="mt-1 w-full h-9 rounded-md border border-stone-300 bg-white px-3 text-sm"
            >
              <option value="all">All (users + owners)</option>
              <option value="users">All users only</option>
              <option value="owners">All owners only</option>
            </select>
            <p className="text-xs text-stone-400 mt-1">To send to a specific person, enter their user ID here.</p>
            {!['all', 'users', 'owners'].includes(target) && target && (
              <p className="text-xs text-blue-600 mt-0.5">Targeting user ID: {target}</p>
            )}
            <Input
              className="mt-2"
              placeholder="Or paste specific user ID..."
              onBlur={(e) => e.target.value && onTargetChange(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-stone-700">Type</label>
            <select
              value={type}
              onChange={(e) => onTypeChange(e.target.value)}
              className="mt-1 w-full h-9 rounded-md border border-stone-300 bg-white px-3 text-sm"
            >
              <option value="admin_message">Admin Message</option>
              <option value="warning">Warning</option>
              <option value="system">System Update</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-stone-700">Title</label>
            <Input
              className="mt-1"
              placeholder="Notification title..."
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-stone-700">Message</label>
            <Textarea
              className="mt-1"
              rows={4}
              placeholder="Write your message here..."
              value={message}
              onChange={(e) => onMessageChange(e.target.value)}
            />
          </div>

          <Button onClick={onSend} disabled={sending || !title.trim() || !message.trim()} className="w-full">
            {sending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending...</> : <><Bell className="w-4 h-4 mr-2" />Send Notification</>}
          </Button>
        </CardContent>
      </Card>
    </div>
  );

const LogsTab = ({ logs, total, page, onPageChange }) => {
  const totalPages = Math.ceil(total / 50);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Activity Logs</h1>
        <p className="text-stone-500 text-sm">{total.toLocaleString()} total actions</p>
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {logs.length === 0 ? (
              <p className="text-center py-12 text-stone-400">No logs found</p>
            ) : logs.map((log) => (
              <div key={log.id} className="p-4 flex items-center gap-4">
                <div className="w-9 h-9 bg-stone-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Activity className="w-4 h-4 text-stone-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className="bg-stone-100 text-stone-700 text-xs">{log.action}</Badge>
                    <span className="text-xs text-stone-500">{log.target_type}: {log.target_id?.slice(0, 12)}...</span>
                  </div>
                  <p className="text-xs text-stone-400 mt-0.5">By {log.actor_email || log.actor_id}</p>
                  {log.meta?.reason && <p className="text-xs text-stone-500">Reason: {log.meta.reason}</p>}
                </div>
                <p className="text-xs text-stone-400 flex-shrink-0">
                  {log.created_at ? new Date(log.created_at).toLocaleString('en-IN') : '--'}
                </p>
              </div>
            ))}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t">
              <p className="text-sm text-stone-500">Page {page} of {totalPages}</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const ProfileModalContent = ({ data, onVerifyEmail }) => {
  if (!data) return (
    <div className="flex justify-center py-12">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
    </div>
  );
  const {
    user, listings, bookings, stats, admin_logs,
  } = data;
  if (!user) return <p className="text-center py-8 text-stone-400">User not found</p>;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center">
          <span className="text-xl font-bold text-primary">{user.name?.[0]?.toUpperCase()}</span>
        </div>
        <div>
          <h3 className="font-bold text-lg">{user.name}</h3>
          <div className="flex items-center gap-2 flex-wrap mt-0.5">
            <Badge className={OWNER_ROLE_COLORS[user.role] || 'bg-blue-100 text-blue-700'}>
              {OWNER_ROLE_LABELS[user.role] || user.role}
            </Badge>
            {user.aadhar_status === 'verified' && <Badge className="bg-green-100 text-green-700">Aadhar Verified</Badge>}
            {user.block_status && <Badge className="bg-red-100 text-red-700">Blocked</Badge>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        {[
          { label: 'Email', value: user.email, verified: user.is_email_verified },
          { label: 'Phone', value: user.phone },
          { label: 'City', value: `${user.city}, ${user.state}` },
          { label: 'Last login', value: user.last_login ? new Date(user.last_login).toLocaleDateString('en-IN') : 'Never' },
          { label: 'Joined', value: user.created_at ? new Date(user.created_at).toLocaleDateString('en-IN') : '--' },
          { label: 'Email verified', value: user.is_email_verified ? 'Yes' : 'No' },
        ].map(({ label, value, verified }) => (
          <div key={label}>
            <p className="text-xs text-stone-400">{label}</p>
            <div className="flex items-center gap-1">
              <p className="font-medium">{value || '--'}</p>
              {verified === false && (
                <Button size="sm" variant="ghost" className="h-5 text-xs px-1 text-blue-600" onClick={() => onVerifyEmail(user.id)}>
                  Verify
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {stats && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Listings', value: stats.total_listings },
            { label: 'Bookings', value: stats.total_bookings },
            { label: 'Views', value: stats.total_views },
            { label: 'Likes', value: stats.total_likes },
          ].map(({ label, value }) => (
            <div key={label} className="bg-stone-100 rounded-lg p-3 text-center">
              <p className="text-xs text-stone-500">{label}</p>
              <p className="text-xl font-bold">{value || 0}</p>
            </div>
          ))}
        </div>
      )}

      {listings?.length > 0 && (
        <div>
          <p className="text-sm font-medium mb-2">Listings ({listings.length})</p>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {listings.map((l) => (
              <div key={l.id} className="flex items-center gap-2 p-2 bg-stone-50 rounded text-sm">
                <Badge className={
                  l.status === 'approved' ? 'bg-green-100 text-green-700' :
                  l.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-red-100 text-red-700'
                }>{l.status}</Badge>
                <span className="truncate">{l.title}</span>
                <span className="text-stone-400 flex-shrink-0">{l.price?.toLocaleString('en-IN')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {admin_logs?.length > 0 && (
        <div>
          <p className="text-sm font-medium mb-2">Admin actions ({admin_logs.length})</p>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {admin_logs.map((l) => (
              <div key={l.id} className="flex items-center gap-2 text-xs text-stone-500 py-1">
                <Badge className="bg-stone-100 text-stone-600 text-xs">{l.action}</Badge>
                <span>{new Date(l.created_at).toLocaleDateString('en-IN')}</span>
                {l.meta?.reason && <span>- {l.meta.reason}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {bookings?.length > 0 && (
        <div>
          <p className="text-sm font-medium mb-2">Bookings ({bookings.length})</p>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {bookings.slice(0, 10).map((b) => (
              <div key={b.id} className="text-xs text-stone-500 py-1">
                {b.status} - {b.created_at ? new Date(b.created_at).toLocaleDateString('en-IN') : '--'}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const BlockUserModal = ({ modal, onClose, onBlock }) => {
  const [blockType, setBlockType] = useState('temporary');
  const [reason, setReason] = useState('');
  const [hours, setHours] = useState(24);

  if (!modal) return null;

  const handleSubmit = () => {
    if (!reason.trim()) {
      toast.error('Reason required');
      return;
    }
    onBlock({
      userId: modal.userId,
      blockType,
      reason,
      durationHours: hours,
    });
  };

  return (
    <Dialog open={!!modal} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Block User: {modal.userName}</DialogTitle>
          <DialogDescription>This will restrict their access immediately.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Block type</label>
            <select value={blockType} onChange={(e) => setBlockType(e.target.value)}
              className="mt-1 w-full h-9 rounded-md border border-stone-300 bg-white px-3 text-sm">
              <option value="temporary">Temporary</option>
              <option value="permanent">Permanent</option>
            </select>
          </div>
          {blockType === 'temporary' && (
            <div>
              <label className="text-sm font-medium">Duration (hours)</label>
              <Input type="number" min={1} value={hours} onChange={(e) => setHours(Number(e.target.value))} className="mt-1" />
            </div>
          )}
          <div>
            <label className="text-sm font-medium">Reason</label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1" rows={3} placeholder="Why are you blocking this user?" />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button onClick={handleSubmit} className="flex-1 bg-red-600 hover:bg-red-700">Block User</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const RejectAadharModal = ({ modal, onClose, onReject }) => {
  const [reason, setReason] = useState('');

  if (!modal) return null;

  return (
    <Dialog open={!!modal} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Reject Aadhar: {modal.ownerName}</DialogTitle>
          <DialogDescription>The owner will be notified with your rejection reason.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Rejection reason</label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1" rows={3}
              placeholder="e.g. Documents unclear, name mismatch..." />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button onClick={() => {
              if (!reason.trim()) {
                toast.error('Rejection reason required');
                return;
              }
              onReject(modal.ownerId, 'rejected', reason);
            }} className="flex-1 bg-red-600 hover:bg-red-700">Reject</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const MiniBarChart = ({ data }) => {
  const maxVal = Math.max(...data.map((d) => (d.users || 0) + (d.owners || 0)), 1);
  return (
    <div>
      <div className="flex items-end gap-2 h-28">
        {data.map((d, i) => {
          const total = (d.users || 0) + (d.owners || 0);
          const heightPct = (total / maxVal) * 100;
          const usersPct = total > 0 ? ((d.users || 0) / total) * 100 : 0;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <p className="text-xs text-stone-400">{total}</p>
              <div className="w-full flex flex-col-reverse overflow-hidden rounded-t"
                style={{ height: `${Math.max(heightPct * 0.8, 2)}px` }}>
                <div className="bg-blue-400" style={{ height: `${usersPct}%` }} />
                <div className="bg-green-400 flex-1" />
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-4 mt-3 text-xs text-stone-500">
        {data.map((d, i) => (
          <span key={i} className="flex-1 text-center truncate">{d.date?.slice(5)}</span>
        ))}
      </div>
      <div className="flex gap-4 mt-2 text-xs text-stone-400">
        <span className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-400 rounded-sm inline-block" />Users</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-400 rounded-sm inline-block" />Owners</span>
      </div>
    </div>
  );
};

export default AdminDashboard;
