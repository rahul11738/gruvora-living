import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { adminAPI } from '../lib/api';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { toast } from 'sonner';
import {
  Users,
  FileText,
  Calendar,
  TrendingUp,
  Home,
  Building2,
  Hotel,
  PartyPopper,
  Wrench,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  Shield,
  LogOut,
  Loader2,
  RotateCcw,
  Download,
  ExternalLink,
} from 'lucide-react';
import { Link } from 'react-router-dom';

const categoryIcons = {
  home: Home,
  business: Building2,
  stay: Hotel,
  event: PartyPopper,
  services: Wrench,
};

export const AdminDashboard = () => {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [listings, setListings] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditActionFilter, setAuditActionFilter] = useState('all');
  const [auditSearch, setAuditSearch] = useState('');
  const [auditFromDate, setAuditFromDate] = useState('');
  const [auditToDate, setAuditToDate] = useState('');
  const [auditDateError, setAuditDateError] = useState('');
  const [auditRangeLabel, setAuditRangeLabel] = useState('Custom');
  const [auditLogsPage, setAuditLogsPage] = useState(1);
  const [auditLogsTotalPages, setAuditLogsTotalPages] = useState(1);
  const [auditLogsTotal, setAuditLogsTotal] = useState(0);
  const [auditActionCounts, setAuditActionCounts] = useState({});
  const [exportingAudit, setExportingAudit] = useState(false);
  const [mediaJobs, setMediaJobs] = useState([]);
  const [mediaJobStatus, setMediaJobStatus] = useState('failed');
  const [mediaJobsPage, setMediaJobsPage] = useState(1);
  const [mediaJobsTotalPages, setMediaJobsTotalPages] = useState(1);
  const [mediaJobsTotal, setMediaJobsTotal] = useState(0);
  const [mediaJobMaxAttempts, setMediaJobMaxAttempts] = useState(5);
  const [mediaJobCounts, setMediaJobCounts] = useState({
    pending: 0,
    processing: 0,
    retry: 0,
    completed: 0,
    failed: 0,
  });
  const [retryingJobId, setRetryingJobId] = useState(null);
  const [resettingJobId, setResettingJobId] = useState(null);
  const [mediaAutoRefreshEnabled, setMediaAutoRefreshEnabled] = useState(true);
  const [reelsDebugReports, setReelsDebugReports] = useState([]);
  const [reelsDebugStressSessionId, setReelsDebugStressSessionId] = useState('');
  const [reelsDebugUserId, setReelsDebugUserId] = useState('');
  const [reelsDebugFromDate, setReelsDebugFromDate] = useState('');
  const [reelsDebugToDate, setReelsDebugToDate] = useState('');
  const [reelsDebugDateError, setReelsDebugDateError] = useState('');
  const [reelsDebugRangeLabel, setReelsDebugRangeLabel] = useState('All Time');
  const [reelsDebugIncludeCaptures, setReelsDebugIncludeCaptures] = useState(false);
  const [reelsDebugPage, setReelsDebugPage] = useState(1);
  const [reelsDebugTotalPages, setReelsDebugTotalPages] = useState(1);
  const [reelsDebugTotal, setReelsDebugTotal] = useState(0);
  const [reelsDebugLoading, setReelsDebugLoading] = useState(false);
  const [selectedReelsDebugReport, setSelectedReelsDebugReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (!isAdmin) {
      toast.error('Admin access required');
      navigate('/');
      return;
    }
    fetchDashboardData();
    // Initial admin bootstrap; keeping this effect focused to auth/navigation guard only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, navigate]);

  useEffect(() => {
    if (activeTab !== 'media-jobs' || !mediaAutoRefreshEnabled) return undefined;

    const intervalId = setInterval(() => {
      fetchMediaJobs(mediaJobStatus, mediaJobsPage);
    }, 15000);

    return () => clearInterval(intervalId);
    // Intentionally scoped to media tab state; fetch function is stateful and would rearm loop every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, mediaJobStatus, mediaJobsPage, mediaAutoRefreshEnabled]);

  useEffect(() => {
    if (activeTab !== 'audit-logs') return;
    if (!auditFromDate && !auditToDate) {
      const today = new Date();
      const start = new Date();
      start.setDate(today.getDate() - 6);
      const toISODate = (d) => d.toISOString().slice(0, 10);
      const defaultFrom = toISODate(start);
      const defaultTo = toISODate(today);
      setAuditFromDate(defaultFrom);
      setAuditToDate(defaultTo);
      setAuditRangeLabel('Last 7 Days');
      fetchAuditLogs(auditActionFilter, 1, defaultFrom, defaultTo);
      return;
    }
    fetchAuditLogs(auditActionFilter, 1, auditFromDate, auditToDate);
    // Intentionally triggered only on tab switch; other filters are handled by dedicated effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'audit-logs') return undefined;

    const handle = setTimeout(() => {
      fetchAuditLogs(auditActionFilter, 1, auditFromDate, auditToDate, auditSearch);
    }, 300);

    return () => clearTimeout(handle);
    // Search-only debounce effect; intentionally excludes non-search deps to avoid duplicate refreshes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auditSearch]);

  const isAuditDateRangeValid = (fromDate = auditFromDate, toDate = auditToDate) => {
    if (!fromDate || !toDate) {
      setAuditDateError('');
      return true;
    }
    if (fromDate > toDate) {
      setAuditDateError('From date cannot be later than To date');
      return false;
    }
    setAuditDateError('');
    return true;
  };

  const formatAsDateInput = (date) => date.toISOString().slice(0, 10);

  const applyAuditPreset = async (preset) => {
    const today = new Date();
    const start = new Date(today);

    if (preset === 'today') {
      // same day range
    } else if (preset === '7d') {
      start.setDate(today.getDate() - 6);
    } else if (preset === '30d') {
      start.setDate(today.getDate() - 29);
    }

    const from = formatAsDateInput(start);
    const to = formatAsDateInput(today);
    setAuditFromDate(from);
    setAuditToDate(to);
    const presetLabel = preset === 'today' ? 'Today' : preset === '7d' ? 'Last 7 Days' : 'Last 30 Days';
    setAuditRangeLabel(presetLabel);
    setAuditLogsPage(1);
    await fetchAuditLogs(auditActionFilter, 1, from, to);
  };

  const fetchDashboardData = async () => {
    try {
      const [statsRes, usersRes, listingsRes, bookingsRes, mediaJobsRes] = await Promise.all([
        adminAPI.getStats(),
        adminAPI.getUsers({ limit: 50 }),
        adminAPI.getListings({ limit: 50 }),
        adminAPI.getBookings({ limit: 50 }),
        adminAPI.getMediaDeleteJobs({ status: mediaJobStatus, page: 1, limit: 20 }),
      ]);
      setStats(statsRes.data);
      setUsers(usersRes.data.users);
      setListings(listingsRes.data.listings);
      setBookings(bookingsRes.data.bookings);
      setMediaJobs(mediaJobsRes.data.jobs || []);
      setMediaJobsTotal(mediaJobsRes.data.total || 0);
      setMediaJobsPage(mediaJobsRes.data.page || 1);
      setMediaJobsTotalPages(mediaJobsRes.data.total_pages || 1);
      setMediaJobMaxAttempts(mediaJobsRes.data.max_attempts || 5);
      setMediaJobCounts(mediaJobsRes.data.status_counts || {
        pending: 0,
        processing: 0,
        retry: 0,
        completed: 0,
        failed: 0,
      });
    } catch (error) {
      console.error('Failed to fetch admin data:', error);
      toast.error('Failed to load admin dashboard');
    } finally {
      setLoading(false);
    }
  };

  const fetchMediaJobs = async (status = mediaJobStatus, page = mediaJobsPage) => {
    try {
      const res = await adminAPI.getMediaDeleteJobs({ status, page, limit: 20 });
      setMediaJobs(res.data.jobs || []);
      setMediaJobsTotal(res.data.total || 0);
      setMediaJobsPage(res.data.page || page);
      setMediaJobsTotalPages(res.data.total_pages || 1);
      setMediaJobMaxAttempts(res.data.max_attempts || 5);
      setMediaJobCounts(res.data.status_counts || {
        pending: 0,
        processing: 0,
        retry: 0,
        completed: 0,
        failed: 0,
      });
    } catch (error) {
      console.error('Failed to fetch media jobs:', error);
      toast.error('Failed to load media jobs');
    }
  };

  const fetchAuditLogs = async (
    action = auditActionFilter,
    page = auditLogsPage,
    fromDate = auditFromDate,
    toDate = auditToDate,
    search = auditSearch,
  ) => {
    if (!isAuditDateRangeValid(fromDate, toDate)) {
      return;
    }
    try {
      const params = { page, limit: 20 };
      if (action && action !== 'all') {
        params.action = action;
      }
      if (fromDate) {
        params.from_date = `${fromDate}T00:00:00`;
      }
      if (toDate) {
        params.to_date = `${toDate}T23:59:59`;
      }
      if (search && search.trim()) {
        params.q = search.trim();
      }
      const res = await adminAPI.getAuditLogs(params);
      setAuditLogs(res.data.logs || []);
      setAuditLogsTotal(res.data.total || 0);
      setAuditLogsPage(res.data.page || page);
      setAuditLogsTotalPages(res.data.total_pages || 1);
      setAuditActionCounts(res.data.action_counts || {});
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
      toast.error('Failed to load audit logs');
    }
  };

  const fetchReelsDebugSessions = async (
    page = reelsDebugPage,
    stressSessionId = reelsDebugStressSessionId,
    userId = reelsDebugUserId,
    fromDate = reelsDebugFromDate,
    toDate = reelsDebugToDate,
    includeCaptures = reelsDebugIncludeCaptures,
  ) => {
    if (!isReelsDebugDateRangeValid(fromDate, toDate)) {
      return;
    }
    setReelsDebugLoading(true);
    try {
      const params = {
        page,
        limit: 20,
        include_captures: includeCaptures,
      };
      if (stressSessionId && stressSessionId.trim()) {
        params.stress_session_id = stressSessionId.trim();
      }
      if (userId && userId.trim()) {
        params.user_id = userId.trim();
      }
      if (fromDate) {
        params.from_date = `${fromDate}T00:00:00`;
      }
      if (toDate) {
        params.to_date = `${toDate}T23:59:59`;
      }

      const res = await adminAPI.getReelsDebugSessions(params);
      setReelsDebugReports(res.data.reports || []);
      setReelsDebugTotal(res.data.total || 0);
      setReelsDebugPage(res.data.page || page);
      setReelsDebugTotalPages(res.data.total_pages || 1);
    } catch (error) {
      console.error('Failed to fetch reels debug sessions:', error);
      toast.error('Failed to load reels debug sessions');
    } finally {
      setReelsDebugLoading(false);
    }
  };

  const handleReelsDebugFilterApply = async () => {
    if (!isReelsDebugDateRangeValid(reelsDebugFromDate, reelsDebugToDate)) {
      return;
    }
    setReelsDebugPage(1);
    await fetchReelsDebugSessions(
      1,
      reelsDebugStressSessionId,
      reelsDebugUserId,
      reelsDebugFromDate,
      reelsDebugToDate,
      reelsDebugIncludeCaptures,
    );
  };

  const handleReelsDebugFilterClear = async () => {
    setReelsDebugStressSessionId('');
    setReelsDebugUserId('');
    setReelsDebugFromDate('');
    setReelsDebugToDate('');
    setReelsDebugDateError('');
    setReelsDebugRangeLabel('All Time');
    setReelsDebugIncludeCaptures(false);
    setReelsDebugPage(1);
    await fetchReelsDebugSessions(1, '', '', '', '', false);
  };

  const isReelsDebugDateRangeValid = (fromDate = reelsDebugFromDate, toDate = reelsDebugToDate) => {
    if (!fromDate || !toDate) {
      setReelsDebugDateError('');
      return true;
    }
    if (fromDate > toDate) {
      setReelsDebugDateError('From date cannot be later than To date');
      return false;
    }
    setReelsDebugDateError('');
    return true;
  };

  const applyReelsDebugPreset = async (preset) => {
    const today = new Date();
    const start = new Date(today);

    if (preset === 'today') {
      // same day range
    } else if (preset === '7d') {
      start.setDate(today.getDate() - 6);
    } else if (preset === '30d') {
      start.setDate(today.getDate() - 29);
    }

    const from = formatAsDateInput(start);
    const to = formatAsDateInput(today);
    const presetLabel = preset === 'today' ? 'Today' : preset === '7d' ? 'Last 7 Days' : 'Last 30 Days';

    setReelsDebugFromDate(from);
    setReelsDebugToDate(to);
    setReelsDebugRangeLabel(presetLabel);
    setReelsDebugPage(1);
    await fetchReelsDebugSessions(
      1,
      reelsDebugStressSessionId,
      reelsDebugUserId,
      from,
      to,
      reelsDebugIncludeCaptures,
    );
  };

  const handleExportSingleReelsReport = (report) => {
    try {
      const payload = {
        ...report,
        exported_at: new Date().toISOString(),
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const safeSessionId = (report.stress_session_id || 'session').replace(/[^a-zA-Z0-9-_]/g, '_');
      const safeReportId = (report.id || 'report').replace(/[^a-zA-Z0-9-_]/g, '_');
      const fileName = `reels_debug_${safeSessionId}_${safeReportId}.json`;

      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Debug report exported');
    } catch (error) {
      console.error('Failed to export debug report:', error);
      toast.error('Failed to export debug report');
    }
  };

  const handleAuditActionFilterChange = async (action) => {
    setAuditActionFilter(action);
    setAuditLogsPage(1);
    await fetchAuditLogs(action, 1, auditFromDate, auditToDate);
  };

  const handleAuditDateFilterApply = async () => {
    if (!isAuditDateRangeValid(auditFromDate, auditToDate)) {
      return;
    }
    setAuditLogsPage(1);
    await fetchAuditLogs(auditActionFilter, 1, auditFromDate, auditToDate, auditSearch);
  };

  const handleAuditSearchApply = async () => {
    setAuditLogsPage(1);
    await fetchAuditLogs(auditActionFilter, 1, auditFromDate, auditToDate, auditSearch);
  };

  const handleAuditSearchClear = async () => {
    setAuditSearch('');
    setAuditLogsPage(1);
    await fetchAuditLogs(auditActionFilter, 1, auditFromDate, auditToDate, '');
  };

  const handleExportAuditLogs = async () => {
    if (!isAuditDateRangeValid(auditFromDate, auditToDate)) {
      return;
    }
    setExportingAudit(true);
    try {
      const params = { limit: 5000 };
      if (auditActionFilter !== 'all') {
        params.action = auditActionFilter;
      }
      if (auditSearch && auditSearch.trim()) {
        params.q = auditSearch.trim();
      }
      if (auditFromDate) {
        params.from_date = `${auditFromDate}T00:00:00`;
      }
      if (auditToDate) {
        params.to_date = `${auditToDate}T23:59:59`;
      }

      const response = await adminAPI.getAuditLogsCsv(params);
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const actionPart = auditActionFilter === 'all' ? 'all' : auditActionFilter;
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
      const fileName = `audit_logs_${actionPart}_${timestamp}.csv`;

      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success('Audit logs CSV exported');
    } catch (error) {
      console.error('Failed to export audit logs:', error);
      toast.error('Failed to export CSV');
    } finally {
      setExportingAudit(false);
    }
  };

  const handleMediaStatusChange = async (status) => {
    setMediaJobStatus(status);
    setMediaJobsPage(1);
    await fetchMediaJobs(status, 1);
  };

  const handleRetryMediaJob = async (jobId) => {
    setRetryingJobId(jobId);
    try {
      await adminAPI.retryMediaDeleteJob(jobId);
      toast.success('Retry queued');
      await fetchMediaJobs(mediaJobStatus, mediaJobsPage);
    } catch (error) {
      console.error('Failed to retry media job:', error);
      toast.error(error?.response?.data?.detail || 'Failed to retry job');
    } finally {
      setRetryingJobId(null);
    }
  };

  const handleResetRetryMediaJob = async (jobId) => {
    setResettingJobId(jobId);
    try {
      await adminAPI.resetRetryMediaDeleteJob(jobId);
      toast.success('Attempts reset and retry queued');
      await fetchMediaJobs(mediaJobStatus, mediaJobsPage);
    } catch (error) {
      console.error('Failed to reset/retry media job:', error);
      toast.error(error?.response?.data?.detail || 'Failed to reset/retry job');
    } finally {
      setResettingJobId(null);
    }
  };

  const handleListingStatus = useCallback(async (listingId, status) => {
    try {
      await adminAPI.updateListingStatus(listingId, status);
      setListings(listings.map((l) => (l.id === listingId ? { ...l, status } : l)));
      toast.success(`Listing ${status}`);
    } catch (error) {
      toast.error('Failed to update listing status');
    }
  }, [listings]);

  const handleAadharVerify = useCallback(async (userId, verified) => {
    try {
      await adminAPI.verifyAadhar(userId, verified);
      setUsers(users.map((u) => (u.id === userId ? { ...u, aadhar_status: verified ? 'verified' : 'rejected' } : u)));
      toast.success(verified ? 'Aadhar verified!' : 'Verification rejected');
    } catch (error) {
      toast.error('Failed to update verification status');
    }
  }, [users]);

  const handleLogout = useCallback(() => {
    logout();
    navigate('/');
  }, [logout, navigate]);

  const handleTabChange = (nextTab) => {
    setActiveTab(nextTab);
    if (nextTab === 'reels-debug') {
      const resolvedFrom = reelsDebugFromDate;
      const resolvedTo = reelsDebugToDate;
      fetchReelsDebugSessions(
        1,
        reelsDebugStressSessionId,
        reelsDebugUserId,
        resolvedFrom,
        resolvedTo,
        reelsDebugIncludeCaptures,
      );
    }
  };

  const recentUsers = useMemo(() => users.slice(0, 5), [users]);
  const pendingListings = useMemo(
    () => listings.filter((l) => l.status === 'pending'),
    [listings],
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-100" data-testid="admin-dashboard">
      {/* Header */}
      <header className="bg-stone-900 text-white">
        <div className="container-main py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
                <Home className="w-6 h-6" />
              </div>
              <span className="font-heading font-bold text-xl">GharSetu</span>
            </Link>
            <Badge className="bg-red-600">Admin</Badge>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-stone-400">{user?.email}</span>
            <button onClick={handleLogout} className="text-stone-400 hover:text-white">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <div className="container-main py-8">
        <h1 className="font-heading text-3xl font-bold mb-8">Admin Dashboard</h1>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <Users className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <p className="text-2xl font-bold">{stats?.total_users || 0}</p>
                <p className="text-sm text-muted-foreground">Total Users</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <Shield className="w-8 h-8 text-green-600 mx-auto mb-2" />
                <p className="text-2xl font-bold">{stats?.total_owners || 0}</p>
                <p className="text-sm text-muted-foreground">Owners</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <FileText className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                <p className="text-2xl font-bold">{stats?.total_listings || 0}</p>
                <p className="text-sm text-muted-foreground">Listings</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <Clock className="w-8 h-8 text-yellow-600 mx-auto mb-2" />
                <p className="text-2xl font-bold">{stats?.pending_listings || 0}</p>
                <p className="text-sm text-muted-foreground">Pending</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <Calendar className="w-8 h-8 text-pink-600 mx-auto mb-2" />
                <p className="text-2xl font-bold">{stats?.total_bookings || 0}</p>
                <p className="text-sm text-muted-foreground">Bookings</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <TrendingUp className="w-8 h-8 text-orange-600 mx-auto mb-2" />
                <p className="text-2xl font-bold">{stats?.total_videos || 0}</p>
                <p className="text-sm text-muted-foreground">Videos</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Category Stats */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Listings by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {Object.entries(stats?.category_stats || {}).map(([cat, count]) => {
                const Icon = categoryIcons[cat] || FileText;
                return (
                  <div key={cat} className="flex items-center gap-3 p-4 bg-stone-50 rounded-lg">
                    <Icon className="w-6 h-6 text-primary" />
                    <div>
                      <p className="font-bold">{count}</p>
                      <p className="text-sm text-muted-foreground capitalize">{cat}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="mb-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="users">Users ({users.length})</TabsTrigger>
            <TabsTrigger value="listings">Listings ({listings.length})</TabsTrigger>
            <TabsTrigger value="bookings">Bookings ({bookings.length})</TabsTrigger>
            <TabsTrigger value="media-jobs">Media Jobs ({mediaJobs.length})</TabsTrigger>
            <TabsTrigger value="audit-logs">Audit Logs ({auditLogsTotal})</TabsTrigger>
            <TabsTrigger value="reels-debug">Reels Debug ({reelsDebugTotal})</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Users */}
              <Card>
                <CardHeader>
                  <CardTitle>Recent Users</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {recentUsers.map((u) => (
                      <div key={u.id} className="flex items-center justify-between p-3 bg-stone-50 rounded-lg">
                        <div>
                          <p className="font-medium">{u.name}</p>
                          <p className="text-sm text-muted-foreground">{u.email}</p>
                        </div>
                        <Badge className={u.role === 'owner' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}>
                          {u.role}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Pending Listings */}
              <Card>
                <CardHeader>
                  <CardTitle>Pending Approvals</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {pendingListings
                      .slice(0, 5)
                      .map((listing) => (
                        <div key={listing.id} className="flex items-center justify-between p-3 bg-stone-50 rounded-lg">
                          <div className="flex-1 min-w-0 mr-4">
                            <p className="font-medium truncate">{listing.title}</p>
                            <p className="text-sm text-muted-foreground capitalize">{listing.category}</p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleListingStatus(listing.id, 'approved')}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleListingStatus(listing.id, 'rejected')}
                              className="text-red-600"
                            >
                              <XCircle className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    {pendingListings.length === 0 && (
                      <p className="text-center text-muted-foreground py-4">No pending approvals</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="users">
            <Card>
              <CardContent className="pt-6">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4">Name</th>
                        <th className="text-left py-3 px-4">Email</th>
                        <th className="text-left py-3 px-4">Phone</th>
                        <th className="text-left py-3 px-4">Role</th>
                        <th className="text-left py-3 px-4">Verified</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id} className="border-b hover:bg-stone-50">
                          <td className="py-3 px-4">{u.name}</td>
                          <td className="py-3 px-4">{u.email}</td>
                          <td className="py-3 px-4">{u.phone}</td>
                          <td className="py-3 px-4">
                            <Badge className={
                              u.role === 'admin' ? 'bg-red-100 text-red-700' :
                              u.role?.includes('owner') || u.role === 'service_provider' ? 'bg-green-100 text-green-700' :
                              'bg-blue-100 text-blue-700'
                            }>
                              {u.role}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            {u.aadhar_status === 'verified' ? (
                              <Badge className="bg-green-100 text-green-700">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Verified
                              </Badge>
                            ) : u.aadhar_number ? (
                              <div className="flex items-center gap-2">
                                <Badge className="bg-yellow-100 text-yellow-700">Pending</Badge>
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  className="h-7 text-xs"
                                  onClick={() => handleAadharVerify(u.id, true)}
                                >
                                  Verify
                                </Button>
                              </div>
                            ) : (
                              <Badge className="bg-stone-100 text-stone-600">No Aadhar</Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="listings">
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {listings.map((listing) => {
                    const Icon = categoryIcons[listing.category] || FileText;
                    return (
                      <div key={listing.id} className="flex items-center gap-4 p-4 bg-stone-50 rounded-lg">
                        <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                          <img
                            src={listing.images?.[0] || 'https://images.unsplash.com/photo-1744311971549-9c529b60b98a?w=200'}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Icon className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground capitalize">{listing.category}</span>
                            <Badge className={
                              listing.status === 'approved' ? 'bg-green-100 text-green-700' :
                              listing.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-red-100 text-red-700'
                            }>
                              {listing.status}
                            </Badge>
                          </div>
                          <h4 className="font-medium truncate">{listing.title}</h4>
                          <p className="text-sm text-muted-foreground">by {listing.owner_name}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-primary">₹{listing.price?.toLocaleString('en-IN')}</p>
                          <p className="text-sm text-muted-foreground capitalize">{listing.listing_type}</p>
                        </div>
                        {listing.status === 'pending' && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleListingStatus(listing.id, 'approved')}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleListingStatus(listing.id, 'rejected')}
                              className="text-red-600"
                            >
                              Reject
                            </Button>
                          </div>
                        )}
                        <Link to={`/listing/${listing.id}`}>
                          <Button variant="ghost" size="sm">
                            <Eye className="w-4 h-4" />
                          </Button>
                        </Link>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="bookings">
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {bookings.map((booking) => (
                    <div key={booking.id} className="flex items-center gap-4 p-4 bg-stone-50 rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={
                            booking.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                            booking.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                            booking.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                            'bg-blue-100 text-blue-700'
                          }>
                            {booking.status}
                          </Badge>
                        </div>
                        <h4 className="font-medium">{booking.listing_title}</h4>
                        <p className="text-sm text-muted-foreground">
                          Booked by: {booking.user_name} | Date: {booking.booking_date}
                        </p>
                      </div>
                      <p className="font-bold text-primary">₹{booking.total_price?.toLocaleString('en-IN')}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="media-jobs">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-4">
                  <CardTitle>Media Delete Jobs</CardTitle>
                  <div className="flex items-center gap-2">
                    <select
                      value={mediaJobStatus}
                      onChange={(e) => handleMediaStatusChange(e.target.value)}
                      className="h-9 rounded-md border border-stone-300 bg-white px-3 text-sm"
                    >
                      <option value="failed">Failed</option>
                      <option value="retry">Retry</option>
                      <option value="pending">Pending</option>
                      <option value="processing">Processing</option>
                      <option value="completed">Completed</option>
                    </select>
                    <Button variant="outline" size="sm" onClick={() => fetchMediaJobs(mediaJobStatus, mediaJobsPage)}>
                      Refresh
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setMediaAutoRefreshEnabled((prev) => !prev)}
                    >
                      {mediaAutoRefreshEnabled ? 'Pause Auto' : 'Resume Auto'}
                    </Button>
                    {activeTab === 'media-jobs' && (
                      <Badge className={mediaAutoRefreshEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-200 text-stone-700'}>
                        {mediaAutoRefreshEnabled ? 'Auto refresh: 15s' : 'Auto refresh: paused'}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
                  <div className="rounded-lg bg-red-50 p-3">
                    <p className="text-xs text-red-700">Failed</p>
                    <p className="text-xl font-bold text-red-700">{mediaJobCounts.failed || 0}</p>
                  </div>
                  <div className="rounded-lg bg-amber-50 p-3">
                    <p className="text-xs text-amber-700">Retry</p>
                    <p className="text-xl font-bold text-amber-700">{mediaJobCounts.retry || 0}</p>
                  </div>
                  <div className="rounded-lg bg-blue-50 p-3">
                    <p className="text-xs text-blue-700">Pending</p>
                    <p className="text-xl font-bold text-blue-700">{mediaJobCounts.pending || 0}</p>
                  </div>
                  <div className="rounded-lg bg-indigo-50 p-3">
                    <p className="text-xs text-indigo-700">Processing</p>
                    <p className="text-xl font-bold text-indigo-700">{mediaJobCounts.processing || 0}</p>
                  </div>
                  <div className="rounded-lg bg-emerald-50 p-3">
                    <p className="text-xs text-emerald-700">Completed</p>
                    <p className="text-xl font-bold text-emerald-700">{mediaJobCounts.completed || 0}</p>
                  </div>
                </div>

                {mediaJobs.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No media jobs found</p>
                ) : (
                  <div className="space-y-3">
                    {mediaJobs.map((job) => (
                      <div key={job.id} className="flex items-center justify-between gap-4 p-4 bg-stone-50 rounded-lg">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{job.public_id}</p>
                          <p className="text-xs text-muted-foreground">
                            Status: {job.status} | Attempts: {job.attempts || 0}
                          </p>
                          {job.last_error && (
                            <p className="text-xs text-red-600 mt-1 truncate">Error: {job.last_error}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {(job.status === 'failed' || job.status === 'retry') && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRetryMediaJob(job.id)}
                              disabled={retryingJobId === job.id || (job.attempts || 0) >= mediaJobMaxAttempts}
                            >
                              {retryingJobId === job.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <RotateCcw className="w-4 h-4" />
                              )}
                            </Button>
                          )}
                          {job.status === 'failed' && (job.attempts || 0) >= mediaJobMaxAttempts && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleResetRetryMediaJob(job.id)}
                              disabled={resettingJobId === job.id}
                            >
                              {resettingJobId === job.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                'Reset+Retry'
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-5 flex items-center justify-between border-t pt-4">
                  <p className="text-sm text-muted-foreground">
                    Page {mediaJobsPage} of {mediaJobsTotalPages} • Total {mediaJobsTotal}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchMediaJobs(mediaJobStatus, Math.max(1, mediaJobsPage - 1))}
                      disabled={mediaJobsPage <= 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchMediaJobs(mediaJobStatus, Math.min(mediaJobsTotalPages, mediaJobsPage + 1))}
                      disabled={mediaJobsPage >= mediaJobsTotalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audit-logs">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-4">
                  <CardTitle>Admin Audit Logs</CardTitle>
                  <div className="flex items-center gap-2">
                    <select
                      value={auditActionFilter}
                      onChange={(e) => handleAuditActionFilterChange(e.target.value)}
                      className="h-9 rounded-md border border-stone-300 bg-white px-3 text-sm"
                    >
                      <option value="all">All Actions</option>
                      <option value="media_delete_job_retry">Retry</option>
                      <option value="media_delete_job_reset_retry">Reset Retry</option>
                    </select>
                    <Button variant="outline" size="sm" onClick={() => fetchAuditLogs(auditActionFilter, auditLogsPage)}>
                      Refresh
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExportAuditLogs}
                      disabled={exportingAudit}
                    >
                      {exportingAudit ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        'Export CSV'
                      )}
                    </Button>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={auditSearch}
                    onChange={(e) => setAuditSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAuditSearchApply();
                      }
                    }}
                    placeholder="Search actor/job/public_id"
                    className="h-9 rounded-md border border-stone-300 bg-white px-3 text-sm min-w-[240px]"
                  />
                  <Button variant="outline" size="sm" onClick={handleAuditSearchApply}>
                    Search
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleAuditSearchClear}>
                    Clear Search
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => applyAuditPreset('today')}>
                    Today
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => applyAuditPreset('7d')}>
                    Last 7 Days
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => applyAuditPreset('30d')}>
                    Last 30 Days
                  </Button>
                  <input
                    type="date"
                    value={auditFromDate}
                    onChange={(e) => {
                      setAuditFromDate(e.target.value);
                      setAuditRangeLabel('Custom');
                      if (auditDateError) {
                        isAuditDateRangeValid(e.target.value, auditToDate);
                      }
                    }}
                    className="h-9 rounded-md border border-stone-300 bg-white px-3 text-sm"
                  />
                  <input
                    type="date"
                    value={auditToDate}
                    onChange={(e) => {
                      setAuditToDate(e.target.value);
                      setAuditRangeLabel('Custom');
                      if (auditDateError) {
                        isAuditDateRangeValid(auditFromDate, e.target.value);
                      }
                    }}
                    className="h-9 rounded-md border border-stone-300 bg-white px-3 text-sm"
                  />
                  <Button variant="outline" size="sm" onClick={handleAuditDateFilterApply}>
                    Apply Dates
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      setAuditFromDate('');
                      setAuditToDate('');
                      setAuditDateError('');
                      setAuditRangeLabel('All Time');
                      setAuditLogsPage(1);
                      await fetchAuditLogs(auditActionFilter, 1, '', '', auditSearch);
                    }}
                  >
                    Clear Dates
                  </Button>
                  <Badge className="bg-stone-200 text-stone-700">Range: {auditRangeLabel}</Badge>
                </div>
                {auditDateError && (
                  <p className="mt-2 text-sm text-red-600">{auditDateError}</p>
                )}
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
                  <div className="rounded-lg bg-stone-100 p-3">
                    <p className="text-xs text-stone-600">Total Logs</p>
                    <p className="text-xl font-bold text-stone-800">{auditLogsTotal}</p>
                  </div>
                  <div className="rounded-lg bg-blue-50 p-3">
                    <p className="text-xs text-blue-700">Retry Actions</p>
                    <p className="text-xl font-bold text-blue-700">{auditActionCounts.media_delete_job_retry || 0}</p>
                  </div>
                  <div className="rounded-lg bg-indigo-50 p-3">
                    <p className="text-xs text-blue-700">Reset Retry Actions</p>
                    <p className="text-xl font-bold text-blue-700">{auditActionCounts.media_delete_job_reset_retry || 0}</p>
                  </div>
                  <div className="rounded-lg bg-emerald-50 p-3 md:col-span-1">
                    <p className="text-xs text-emerald-700">Visible Rows</p>
                    <p className="text-xl font-bold text-emerald-700">{auditLogs.length}</p>
                  </div>
                </div>

                {auditLogs.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No audit logs found</p>
                ) : (
                  <div className="space-y-3">
                    {auditLogs.map((log) => (
                      <div key={log.id} className="p-4 bg-stone-50 rounded-lg">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-medium">{log.action}</p>
                          <Badge className="bg-stone-200 text-stone-700">{new Date(log.created_at).toLocaleString('en-IN')}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          Actor: {log.actor_email || log.actor_id} | Target: {log.target_type} ({log.target_id})
                        </p>
                        {log.meta && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Prev status: {log.meta.previous_status || '-'} | Prev attempts: {log.meta.previous_attempts ?? '-'}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-5 flex items-center justify-between border-t pt-4">
                  <p className="text-sm text-muted-foreground">
                    Page {auditLogsPage} of {auditLogsTotalPages} • Total {auditLogsTotal}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchAuditLogs(auditActionFilter, Math.max(1, auditLogsPage - 1))}
                      disabled={auditLogsPage <= 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchAuditLogs(auditActionFilter, Math.min(auditLogsTotalPages, auditLogsPage + 1))}
                      disabled={auditLogsPage >= auditLogsTotalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reels-debug">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-4">
                  <CardTitle>Reels Debug Sessions</CardTitle>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchReelsDebugSessions(reelsDebugPage)}
                      disabled={reelsDebugLoading}
                    >
                      {reelsDebugLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Refresh'}
                    </Button>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => applyReelsDebugPreset('today')} disabled={reelsDebugLoading}>
                    Today
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => applyReelsDebugPreset('7d')} disabled={reelsDebugLoading}>
                    Last 7 Days
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => applyReelsDebugPreset('30d')} disabled={reelsDebugLoading}>
                    Last 30 Days
                  </Button>
                  <input
                    type="text"
                    value={reelsDebugStressSessionId}
                    onChange={(e) => setReelsDebugStressSessionId(e.target.value)}
                    placeholder="Stress session ID"
                    className="h-9 rounded-md border border-stone-300 bg-white px-3 text-sm min-w-[220px]"
                  />
                  <input
                    type="text"
                    value={reelsDebugUserId}
                    onChange={(e) => setReelsDebugUserId(e.target.value)}
                    placeholder="User ID"
                    className="h-9 rounded-md border border-stone-300 bg-white px-3 text-sm min-w-[220px]"
                  />
                  <input
                    type="date"
                    value={reelsDebugFromDate}
                    onChange={(e) => {
                      setReelsDebugFromDate(e.target.value);
                      setReelsDebugRangeLabel('Custom');
                      if (reelsDebugDateError) {
                        isReelsDebugDateRangeValid(e.target.value, reelsDebugToDate);
                      }
                    }}
                    className="h-9 rounded-md border border-stone-300 bg-white px-3 text-sm"
                  />
                  <input
                    type="date"
                    value={reelsDebugToDate}
                    onChange={(e) => {
                      setReelsDebugToDate(e.target.value);
                      setReelsDebugRangeLabel('Custom');
                      if (reelsDebugDateError) {
                        isReelsDebugDateRangeValid(reelsDebugFromDate, e.target.value);
                      }
                    }}
                    className="h-9 rounded-md border border-stone-300 bg-white px-3 text-sm"
                  />
                  <label className="h-9 inline-flex items-center gap-2 rounded-md border border-stone-300 bg-white px-3 text-sm">
                    <input
                      type="checkbox"
                      checked={reelsDebugIncludeCaptures}
                      onChange={(e) => setReelsDebugIncludeCaptures(e.target.checked)}
                    />
                    Include captures
                  </label>
                  <Button variant="outline" size="sm" onClick={handleReelsDebugFilterApply} disabled={reelsDebugLoading}>
                    Apply Filters
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleReelsDebugFilterClear} disabled={reelsDebugLoading}>
                    Clear
                  </Button>
                  <Badge className="bg-stone-200 text-stone-700">Range: {reelsDebugRangeLabel}</Badge>
                </div>
                {reelsDebugDateError && (
                  <p className="mt-2 text-sm text-red-600">{reelsDebugDateError}</p>
                )}
              </CardHeader>

              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-5">
                  <div className="rounded-lg bg-stone-100 p-3">
                    <p className="text-xs text-stone-600">Total Reports</p>
                    <p className="text-xl font-bold text-stone-800">{reelsDebugTotal}</p>
                  </div>
                  <div className="rounded-lg bg-blue-50 p-3">
                    <p className="text-xs text-blue-700">Visible Reports</p>
                    <p className="text-xl font-bold text-blue-700">{reelsDebugReports.length}</p>
                  </div>
                  <div className="rounded-lg bg-amber-50 p-3">
                    <p className="text-xs text-amber-700">Reports With Captures</p>
                    <p className="text-xl font-bold text-amber-700">
                      {reelsDebugReports.filter((r) => (r.total_captures || 0) > 0).length}
                    </p>
                  </div>
                  <div className="rounded-lg bg-emerald-50 p-3">
                    <p className="text-xs text-emerald-700">Total Captures (Visible)</p>
                    <p className="text-xl font-bold text-emerald-700">
                      {reelsDebugReports.reduce((sum, r) => sum + (r.total_captures || 0), 0)}
                    </p>
                  </div>
                </div>

                {reelsDebugLoading ? (
                  <div className="py-8 flex items-center justify-center text-muted-foreground gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading reports...
                  </div>
                ) : reelsDebugReports.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No debug reports found</p>
                ) : (
                  <div className="space-y-3">
                    {reelsDebugReports.map((report) => {
                      const stats = report.stats || {};
                      const snapshotHits = Number(stats.snapshotHits || 0);
                      const snapshotMisses = Number(stats.snapshotMisses || 0);
                      const totalSnapshotReads = snapshotHits + snapshotMisses;
                      const snapshotHitRate = totalSnapshotReads > 0
                        ? Math.round((snapshotHits / totalSnapshotReads) * 100)
                        : null;

                      return (
                        <div key={report.id} className="p-4 bg-stone-50 rounded-lg">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-medium">Session: {report.stress_session_id || '-'}</p>
                              <p className="text-sm text-muted-foreground">
                                User: {report.user_email || report.user_id || '-'}
                              </p>
                            </div>
                            <Badge className="bg-stone-200 text-stone-700">
                              {report.created_at ? new Date(report.created_at).toLocaleString('en-IN') : '-'}
                            </Badge>
                          </div>

                          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                            <div className="rounded bg-white p-2">
                              <p className="text-xs text-muted-foreground">Snapshot Calls</p>
                              <p className="font-semibold">{Number(stats.snapshotHttpCalls || 0)}</p>
                            </div>
                            <div className="rounded bg-white p-2">
                              <p className="text-xs text-muted-foreground">Snapshot Hit Rate</p>
                              <p className="font-semibold">{snapshotHitRate === null ? '-' : `${snapshotHitRate}%`}</p>
                            </div>
                            <div className="rounded bg-white p-2">
                              <p className="text-xs text-muted-foreground">Stale Follow Skips</p>
                              <p className="font-semibold">{Number(stats.staleFollowSkips || 0)}</p>
                            </div>
                            <div className="rounded bg-white p-2">
                              <p className="text-xs text-muted-foreground">Stale Like Skips</p>
                              <p className="font-semibold">{Number(stats.staleLikeSkips || 0)}</p>
                            </div>
                          </div>

                          <p className="mt-2 text-xs text-muted-foreground">
                            Captures: {report.total_captures || 0} | History points: {(report.hit_rate_history || []).length}
                          </p>

                          <div className="mt-3 flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedReelsDebugReport(report)}
                            >
                              <ExternalLink className="w-4 h-4 mr-1" />
                              View Details
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleExportSingleReelsReport(report)}
                            >
                              <Download className="w-4 h-4 mr-1" />
                              Export JSON
                            </Button>
                          </div>

                          {reelsDebugIncludeCaptures && Array.isArray(report.captures) && report.captures.length > 0 && (
                            <details className="mt-2">
                              <summary className="cursor-pointer text-sm text-primary">Show captures ({report.captures.length})</summary>
                              <pre className="mt-2 max-h-56 overflow-auto rounded bg-stone-900 text-stone-100 p-3 text-xs">
                                {JSON.stringify(report.captures.slice(0, 5), null, 2)}
                              </pre>
                            </details>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="mt-5 flex items-center justify-between border-t pt-4">
                  <p className="text-sm text-muted-foreground">
                    Page {reelsDebugPage} of {reelsDebugTotalPages} • Total {reelsDebugTotal}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchReelsDebugSessions(Math.max(1, reelsDebugPage - 1))}
                      disabled={reelsDebugLoading || reelsDebugPage <= 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchReelsDebugSessions(Math.min(reelsDebugTotalPages, reelsDebugPage + 1))}
                      disabled={reelsDebugLoading || reelsDebugPage >= reelsDebugTotalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Dialog
              open={Boolean(selectedReelsDebugReport)}
              onOpenChange={(open) => {
                if (!open) {
                  setSelectedReelsDebugReport(null);
                }
              }}
            >
              <DialogContent className="max-w-4xl">
                <DialogHeader>
                  <DialogTitle>Reels Debug Report Details</DialogTitle>
                </DialogHeader>
                {selectedReelsDebugReport && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div className="rounded bg-stone-100 p-3">
                        <p><span className="font-semibold">Report ID:</span> {selectedReelsDebugReport.id || '-'}</p>
                        <p><span className="font-semibold">Session:</span> {selectedReelsDebugReport.stress_session_id || '-'}</p>
                        <p><span className="font-semibold">User:</span> {selectedReelsDebugReport.user_email || selectedReelsDebugReport.user_id || '-'}</p>
                      </div>
                      <div className="rounded bg-stone-100 p-3">
                        <p><span className="font-semibold">Created:</span> {selectedReelsDebugReport.created_at ? new Date(selectedReelsDebugReport.created_at).toLocaleString('en-IN') : '-'}</p>
                        <p><span className="font-semibold">Captures:</span> {selectedReelsDebugReport.total_captures || 0}</p>
                        <p><span className="font-semibold">History points:</span> {(selectedReelsDebugReport.hit_rate_history || []).length}</p>
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-semibold mb-1">Stats</p>
                      <pre className="max-h-48 overflow-auto rounded bg-stone-900 text-stone-100 p-3 text-xs">
                        {JSON.stringify(selectedReelsDebugReport.stats || {}, null, 2)}
                      </pre>
                    </div>

                    <div>
                      <p className="text-sm font-semibold mb-1">Hit Rate History</p>
                      <pre className="max-h-40 overflow-auto rounded bg-stone-900 text-stone-100 p-3 text-xs">
                        {JSON.stringify(selectedReelsDebugReport.hit_rate_history || [], null, 2)}
                      </pre>
                    </div>

                    <div>
                      <p className="text-sm font-semibold mb-1">Captures</p>
                      <pre className="max-h-64 overflow-auto rounded bg-stone-900 text-stone-100 p-3 text-xs">
                        {JSON.stringify(selectedReelsDebugReport.captures || [], null, 2)}
                      </pre>
                    </div>

                    <div className="flex items-center justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleExportSingleReelsReport(selectedReelsDebugReport)}
                      >
                        <Download className="w-4 h-4 mr-1" />
                        Export This Report
                      </Button>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminDashboard;
