import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
import { toast } from 'sonner';
import gruvoraLogo from '../assets/gruvoraLogo.jpeg';
import OptimizedImage from './OptimizedImage';
import {
  Home,
  Mail,
  Lock,
  User,
  Phone,
  CreditCard,
  Eye,
  EyeOff,
  ArrowRight,
  Shield,
  Hotel,
  Wrench,
  PartyPopper,
  Sparkles,
  CheckCircle2,
  Zap,
  Crown,
  AlertCircle,
  Loader2,
} from 'lucide-react';

const SUBSCRIPTION_ROLES = new Set(['property_owner', 'stay_owner', 'service_provider', 'event_owner']);
const COMMISSION_ROLES = new Set(['hotel_owner']);

const OWNER_TYPES = [
  {
    value: 'property_owner', label: 'Property Owner', labelGu: 'પ્રોપર્ટી માલિક',
    icon: Home, model: 'commission',
    hint: '5% commission per deal. No monthly fee.',
  },
  {
    value: 'service_provider', label: 'Service Provider', labelGu: 'સેવા પ્રદાતા',
    icon: Wrench, model: 'subscription',
    hint: '₹251/month after free trial.',
  },
  {
    value: 'hotel_owner', label: 'Hotel Owner', labelGu: 'હોટેલ માલિક',
    icon: Hotel, model: 'commission',
    hint: '5% commission per booking. No monthly fee.',
  },
  {
    value: 'event_owner', label: 'Event Venue Owner', labelGu: 'ઇવેન્ટ માલિક',
    icon: PartyPopper, model: 'subscription',
    hint: '₹251/month after free trial.',
  },
];

export const LoginPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await login(formData.email, formData.password);
      toast.success('Login successful!');

      const redirect = searchParams.get('redirect');
      if (redirect) {
        navigate(redirect);
      } else {
        // Redirect based on role
        if (result.user.role === 'admin') {
          navigate('/admin');
        } else if (['property_owner', 'service_provider', 'hotel_owner', 'event_owner'].includes(result.user.role)) {
          navigate('/owner/dashboard');
        } else {
          navigate('/dashboard');
        }
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-b from-stone-50 via-white to-emerald-50/40" data-testid="login-page">
      <div className="relative min-h-screen flex items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
        <div className="w-full max-w-md">
          <div className="rounded-[1.75rem] border border-stone-200 bg-white shadow-[0_12px_36px_rgba(15,23,42,0.06)] overflow-hidden">
            <div className="p-5 sm:p-7 md:p-8">
              <Link to="/" className="inline-flex items-center mb-6 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2">
                <OptimizedImage
                  publicId={gruvoraLogo}
                  alt="Gruvora"
                  className="h-10 sm:h-11 w-auto max-w-[180px] object-contain"
                  width={180}
                  sizes="180px"
                />
              </Link>

              <div className="mb-6">
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-700">
                  <Shield className="w-3.5 h-3.5" />
                  Secure Access
                </span>
                <h1 className="font-heading text-3xl sm:text-4xl font-bold text-stone-950 mt-3 mb-2 tracking-tight">Welcome Back</h1>
                <p className="text-muted-foreground text-sm sm:text-base">Enter your credentials to access your account.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-4.5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium text-stone-700">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="Enter your email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="pl-12 h-12 rounded-xl border-stone-200 bg-white shadow-sm focus-visible:ring-emerald-500/20"
                      required
                      data-testid="login-email-input"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium text-stone-700">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="pl-12 pr-12 h-12 rounded-xl border-stone-200 bg-white shadow-sm focus-visible:ring-emerald-500/20"
                      required
                      data-testid="login-password-input"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-stone-900 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <Button type="submit" className="w-full h-12 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm" disabled={loading} data-testid="login-submit-btn">
                  {loading ? 'Signing in...' : 'Sign In'}
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </form>

              <p className="text-center text-muted-foreground mt-8">
                Don't have an account?{' '}
                <Link to="/register" className="text-primary font-medium hover:underline">
                  Register
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const RegisterPage = () => {
  const navigate = useNavigate();
  const { register, registerOwner } = useAuth();

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState('user');

  const [couponInput, setCouponInput] = useState('');
  const [couponState, setCouponState] = useState(null);
  const [couponChecking, setCouponChecking] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    gender: 'male',
    address: '',
    city: 'Surat',
    state: 'Gujarat',
    role: 'property_owner',
    aadhar_number: '',
    aadhar_name: '',
    business_name: '',
  });

  const selectedOwnerType = OWNER_TYPES.find(t => t.value === formData.role);
  const SelectedOwnerIcon = selectedOwnerType?.icon;
  const isSubscriptionRole = SUBSCRIPTION_ROLES.has(formData.role);
  const isCommissionRole = COMMISSION_ROLES.has(formData.role);
  // Coupon is optional - all owners get 5 months free trial automatically
  const canRegisterOwner = true;

  const handleRoleChange = (role) => {
    setFormData(p => ({ ...p, role }));
    setCouponInput('');
    setCouponState(null);
  };

  const handleApplyCoupon = async () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) {
      return;
    }

    setCouponChecking(true);
    try {
      const res = await api.post('/subscriptions/coupon/validate', { coupon: code });
      setCouponState({
        valid: true,
        free_months: res.data.free_months,
        message: res.data.benefit,
        code,
      });
      toast.success('Coupon applied!');
    } catch {
      setCouponState({ valid: false, message: 'Invalid coupon code. Please try again.' });
    } finally {
      setCouponChecking(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        ...formData,
        city: formData.city || 'Surat',
        address: formData.address || 'Not provided',
        ...(couponState?.valid ? { coupon: couponState.code } : {}),
      };

      if (activeTab === 'owner') {
        await registerOwner(payload);
        if (isSubscriptionRole && couponState?.valid) {
          toast.success(`🎉 Registered! You have ${couponState.free_months} months free subscription.`);
        } else if (isSubscriptionRole) {
          toast.success('🎉 Registered! You get 5 months free trial automatically.');
        } else {
          toast.success('Registration successful!');
        }
        navigate('/owner/dashboard');
      } else {
        await register(payload);
        toast.success('Registration successful!');
        navigate('/dashboard');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-b from-stone-50 via-white to-emerald-50/40" data-testid="register-page">
      <div className="relative min-h-screen flex items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
        <div className="w-full max-w-xl">
          <div className="rounded-[1.75rem] border border-stone-200 bg-white shadow-[0_12px_36px_rgba(15,23,42,0.06)] overflow-hidden">
            <div className="p-5 sm:p-7 md:p-8">
              <Link to="/" className="inline-flex items-center mb-6 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2">
                <OptimizedImage
                  publicId={gruvoraLogo}
                  alt="Gruvora"
                  className="h-10 sm:h-11 w-auto max-w-[180px] object-contain"
                  width={180}
                  sizes="180px"
                />
              </Link>

              <div className="mb-5">
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-700">
                  <Sparkles className="w-3.5 h-3.5" />
                  Join the Platform
                </span>
                <h1 className="font-heading text-3xl sm:text-4xl font-bold text-stone-950 mt-3 mb-2 tracking-tight">Create Account</h1>
                <p className="text-muted-foreground text-sm sm:text-base">Register to explore properties and services.</p>
              </div>

              <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-5">
                <TabsList className="grid w-full grid-cols-2 h-12 rounded-full bg-stone-100 p-1 shadow-inner">
                  <TabsTrigger value="user" className="rounded-full data-[state=active]:bg-white data-[state=active]:text-stone-950 data-[state=active]:shadow-sm" data-testid="tab-user">
                    <User className="w-4 h-4 mr-2" />
                    User
                  </TabsTrigger>
                  <TabsTrigger value="owner" className="rounded-full data-[state=active]:bg-white data-[state=active]:text-stone-950 data-[state=active]:shadow-sm" data-testid="tab-owner">
                    <Shield className="w-4 h-4 mr-2" />
                    Owner / Provider
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <form onSubmit={handleSubmit} className="space-y-4.5 sm:space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-sm font-medium text-stone-700">Full Name</Label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        id="name"
                        placeholder="Enter full name"
                        value={formData.name}
                        onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                        className="pl-12 h-12 rounded-xl border-stone-200 bg-white shadow-sm focus-visible:ring-emerald-500/20"
                        required
                        data-testid="register-name-input"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-sm font-medium text-stone-700">Phone</Label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        id="phone"
                        placeholder="+91 XXXXXXXXXX"
                        value={formData.phone}
                        onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))}
                        className="pl-12 h-12 rounded-xl border-stone-200 bg-white shadow-sm focus-visible:ring-emerald-500/20"
                        required
                        data-testid="register-phone-input"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium text-stone-700">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="Enter your email"
                      value={formData.email}
                      onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
                      className="pl-12 h-12 rounded-xl border-stone-200 bg-white shadow-sm focus-visible:ring-emerald-500/20"
                      required
                      data-testid="register-email-input"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium text-stone-700">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Min 8 chars, 1 uppercase, 1 number"
                      value={formData.password}
                      onChange={e => setFormData(p => ({ ...p, password: e.target.value }))}
                      className="pl-12 pr-12 h-12 rounded-xl border-stone-200 bg-white shadow-sm focus-visible:ring-emerald-500/20"
                      required
                      data-testid="register-password-input"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-stone-900 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-stone-700">Gender</Label>
                  <RadioGroup
                    value={formData.gender}
                    onValueChange={value => setFormData(p => ({ ...p, gender: value }))}
                    className="flex gap-4"
                  >
                    {['male', 'female', 'other'].map((g) => (
                      <div key={g} className="flex items-center space-x-2">
                        <RadioGroupItem value={g} id={g} />
                        <Label htmlFor={g} className="font-normal capitalize">{g}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                {/* Owner-specific fields */}
                {activeTab === 'owner' && (
                  <>
                    <Card className="border-secondary/12 bg-secondary/5 rounded-2xl shadow-[0_10px_26px_rgba(15,23,42,0.04)] backdrop-blur-sm">
                      <CardHeader className="pb-4">
                        <CardTitle className="text-base text-stone-900">Select Owner Type</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {OWNER_TYPES.map((type) => {
                            const Icon = type.icon;
                            const isSelected = formData.role === type.value;
                            return (
                              <button
                                key={type.value}
                                type="button"
                                onClick={() => handleRoleChange(type.value)}
                                className={`p-4 rounded-xl border text-left transition-all bg-white/95 shadow-[0_8px_22px_rgba(15,23,42,0.03)] ${isSelected
                                  ? 'border-secondary/40 bg-secondary/8 shadow-[0_10px_24px_rgba(234,88,12,0.08)]'
                                  : 'border-stone-200 hover:border-stone-300'
                                  }`}
                              >
                                <Icon className={`w-6 h-6 mb-2 ${isSelected ? 'text-secondary' : 'text-muted-foreground'}`} />
                                <p className={`font-medium text-sm ${isSelected ? 'text-secondary' : 'text-stone-900'}`}>
                                  {type.label}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">{type.labelGu}</p>
                              </button>
                            );
                          })}
                        </div>
                        {selectedOwnerType && (
                          <div className="mt-4 rounded-2xl border border-stone-200 bg-white px-4 py-3 shadow-sm">
                            <div className="flex items-center gap-2">
                              {SelectedOwnerIcon && <SelectedOwnerIcon className="w-4 h-4 text-primary" />}
                              <p className="font-medium text-sm text-stone-900">{selectedOwnerType.label}</p>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">{selectedOwnerType.hint}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="border-primary/12 bg-primary/5 rounded-2xl shadow-[0_10px_26px_rgba(15,23,42,0.04)] backdrop-blur-sm">
                      <CardHeader className="pb-4">
                        <CardTitle className="text-base flex items-center gap-2 text-stone-900">
                          <Shield className="w-5 h-5 text-primary" />
                          Aadhar Verification
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="aadhar_number">Aadhar Card Number</Label>
                          <div className="relative">
                            <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                            <Input
                              id="aadhar_number"
                              placeholder="XXXX XXXX XXXX"
                              value={formData.aadhar_number}
                              onChange={e => setFormData(p => ({ ...p, aadhar_number: e.target.value }))}
                              className="pl-12 h-12"
                              maxLength={12}
                              required={activeTab === 'owner'}
                              data-testid="register-aadhar-input"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="aadhar_name">Name on Aadhar</Label>
                          <Input
                            id="aadhar_name"
                            placeholder="Name as per Aadhar card"
                            value={formData.aadhar_name}
                            onChange={e => setFormData(p => ({ ...p, aadhar_name: e.target.value }))}
                            className="h-12"
                            required={activeTab === 'owner'}
                            data-testid="register-aadhar-name-input"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="business_name">Business Name (Optional)</Label>
                          <Input
                            id="business_name"
                            placeholder="Your business or brand name"
                            value={formData.business_name}
                            onChange={e => setFormData(p => ({ ...p, business_name: e.target.value }))}
                            className="h-12"
                          />
                        </div>

                        {isSubscriptionRole && (
                          <div className="space-y-3">
                            <Card className={`border transition-all shadow-[0_8px_22px_rgba(15,23,42,0.04)] ${couponState?.valid
                              ? 'border-green-300 bg-green-50/80'
                              : 'border-orange-200 bg-orange-50/80'
                              }`}>
                              <CardContent className="pt-5 space-y-4">
                                <div className="flex items-start gap-3">
                                  {couponState?.valid ? (
                                    <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                                  ) : (
                                    <Zap className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                                  )}
                                  <div>
                                    <p className="font-semibold text-sm">
                                      {couponState?.valid
                                        ? `🎉 Coupon Applied — ${couponState.free_months} Months FREE!`
                                        : '🎁 5 Months Free Trial — Included!'}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                      {couponState?.valid
                                        ? `Enjoy ${couponState.free_months} months free. After that, ₹999/month.`
                                        : 'All owners get 5 months free automatically. Have a special coupon? Apply below.'}
                                    </p>
                                  </div>
                                </div>

                                {!couponState?.valid && (
                                  <div className="flex flex-col sm:flex-row gap-2">
                                    <Input
                                      placeholder="COUPON CODE (optional)"
                                      value={couponInput}
                                      onChange={e => {
                                        setCouponInput(e.target.value.toUpperCase());
                                        if (couponState) {
                                          setCouponState(null);
                                        }
                                      }}
                                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleApplyCoupon())}
                                      className="font-mono uppercase tracking-wider h-11 flex-1 rounded-xl border-stone-200 bg-white shadow-sm"
                                    />
                                    <Button
                                      type="button"
                                      onClick={handleApplyCoupon}
                                      disabled={!couponInput.trim() || couponChecking}
                                      className="h-11 px-5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white shadow-sm"
                                    >
                                      {couponChecking
                                        ? <Loader2 className="w-4 h-4 animate-spin" />
                                        : 'Apply'}
                                    </Button>
                                  </div>
                                )}

                                {couponState && !couponState.valid && (
                                  <div className="flex items-center gap-2 text-red-600 text-sm">
                                    <AlertCircle className="w-4 h-4" />
                                    {couponState.message}
                                  </div>
                                )}

                                {couponState?.valid && (
                                  <div className="rounded-xl bg-green-100 border border-green-300 p-3 text-center">
                                    <p className="text-2xl mb-1">🎉</p>
                                    <p className="font-bold text-green-800 text-base">Congratulations!</p>
                                    <p className="text-green-700 text-sm mt-1">
                                      You get <span className="font-bold">{couponState.free_months} months FREE</span> subscription.
                                    </p>
                                    <p className="text-green-600 text-xs mt-1">
                                      After {couponState.free_months} months → ₹999/month
                                    </p>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setCouponState(null);
                                        setCouponInput('');
                                      }}
                                      className="text-xs text-green-500 hover:text-green-700 mt-2 underline"
                                    >
                                      Remove coupon
                                    </button>
                                  </div>
                                )}

                                {!couponState?.valid && (
                                  <div className="flex items-start gap-2 text-xs text-orange-700 bg-orange-100 rounded-lg p-3">
                                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                    <span>
                                      Coupon code is <strong>required</strong> to complete registration.
                                      Enter <span className="font-mono font-bold">GRUVORA5M</span> for 5 months free.
                                    </span>
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          </div>
                        )}

                        {isCommissionRole && (
                          <div className="p-4 bg-blue-50/80 rounded-xl border border-blue-200/70 text-sm shadow-[0_8px_22px_rgba(15,23,42,0.04)]">
                            <div className="flex items-center gap-2 mb-1">
                              <Crown className="w-4 h-4 text-blue-600" />
                              <p className="font-semibold text-blue-800">No monthly fee</p>
                            </div>
                            <p className="text-blue-700">
                              We take a <strong>5% commission</strong> on each confirmed deal (rent/sell).
                              No upfront cost — you only pay when you earn.
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </>
                )}

                <Button
                  type="submit"
                  className={`w-full h-12 rounded-full ${activeTab === 'owner' && !canRegisterOwner
                    ? 'opacity-50 cursor-not-allowed bg-stone-400'
                    : 'btn-primary shadow-[0_12px_24px_rgba(5,150,105,0.18)]'
                    }`}
                  disabled={loading || (activeTab === 'owner' && !canRegisterOwner)}
                  data-testid="register-submit-btn"
                >
                  {loading ? (
                    <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Creating Account...</>
                  ) : activeTab === 'owner' && isSubscriptionRole && !couponState?.valid ? (
                    <><Lock className="w-5 h-5 mr-2" />Enter Coupon to Register</>
                  ) : (
                    <>{activeTab === 'owner' ? 'Register as Owner' : 'Create Account'} <ArrowRight className="w-5 h-5 ml-2" /></>
                  )}
                </Button>

                {activeTab === 'owner' && isSubscriptionRole && !couponState?.valid && (
                  <p className="text-center text-xs text-muted-foreground">
                    Enter coupon code <span className="font-mono font-bold text-primary">GRUVORA5M</span> above to unlock registration
                  </p>
                )}
              </form>

              <p className="text-center text-muted-foreground mt-6">
                Already have an account?{' '}
                <Link to="/login" className="text-primary font-medium hover:underline">
                  Sign In
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const VerifyEmailPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  const [status, setStatus] = useState('verifying');

  React.useEffect(() => {
    const verifyEmail = async () => {
      if (!token) {
        setStatus('error');
        return;
      }

      try {
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/verify/${token}`);
        if (response.ok) {
          setStatus('success');
          setTimeout(() => navigate('/login'), 3000);
        } else {
          setStatus('error');
        }
      } catch (error) {
        setStatus('error');
      }
    };

    verifyEmail();
  }, [token, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 p-4" data-testid="verify-email-page">
      <Card className="w-full max-w-md text-center">
        <CardContent className="pt-8 pb-8">
          {status === 'verifying' && (
            <>
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                <Mail className="w-8 h-8 text-primary" />
              </div>
              <h2 className="font-heading text-2xl font-bold mb-2">Verifying Email...</h2>
              <p className="text-muted-foreground">Please wait while we verify your email address.</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="font-heading text-2xl font-bold mb-2 text-green-600">Email Verified!</h2>
              <p className="text-muted-foreground">Your email has been verified successfully. Redirecting to login...</p>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Mail className="w-8 h-8 text-red-600" />
              </div>
              <h2 className="font-heading text-2xl font-bold mb-2 text-red-600">Verification Failed</h2>
              <p className="text-muted-foreground mb-6">The verification link is invalid or has expired.</p>
              <Link to="/login">
                <Button className="btn-primary">Go to Login</Button>
              </Link>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
