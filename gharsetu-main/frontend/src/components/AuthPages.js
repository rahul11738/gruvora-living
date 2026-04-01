import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { toast } from 'sonner';
import {
  Home,
  Mail,
  Lock,
  User,
  Phone,
  MapPin,
  CreditCard,
  Eye,
  EyeOff,
  ArrowRight,
  CheckCircle2,
  Shield,
  Building2,
  Hotel,
  Wrench,
  PartyPopper,
  Sparkles,
} from 'lucide-react';

const ownerTypes = [
  { value: 'property_owner', label: 'Property Owner', labelGu: 'પ્રોપર્ટી માલિક', icon: Home, description: 'List residential & commercial properties' },
  { value: 'service_provider', label: 'Service Provider', labelGu: 'સેવા પ્રદાતા', icon: Wrench, description: 'Offer home services like plumber, electrician' },
  { value: 'hotel_owner', label: 'Hotel Owner', labelGu: 'હોટેલ માલિક', icon: Hotel, description: 'List hotels, rooms, guest houses' },
  { value: 'event_owner', label: 'Event Venue Owner', labelGu: 'ઇવેન્ટ માલિક', icon: PartyPopper, description: 'List party plots, marriage halls' },
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
    <div className="min-h-screen flex" data-testid="login-page">
      {/* Left Side - Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-stone-50">
        <div className="w-full max-w-md">
          <Link to="/" className="flex items-center gap-2 mb-8">
            <img
              src="/GruvoraLogo.jpeg"
              alt="Gruvora"
              className="w-10 h-10 rounded-xl object-cover"
            />
            <span className="font-heading font-bold text-2xl text-primary">Gruvora</span>
          </Link>

          <h1 className="font-heading text-3xl font-bold text-stone-900 mb-2">Welcome Back</h1>
          <p className="text-muted-foreground mb-8">Enter your credentials to access your account</p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="pl-12 h-12"
                  required
                  data-testid="login-email-input"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="pl-12 pr-12 h-12"
                  required
                  data-testid="login-password-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full btn-primary h-12" disabled={loading} data-testid="login-submit-btn">
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

      {/* Right Side - Image */}
      <div
        className="hidden lg:flex flex-1 bg-cover bg-center items-center justify-center p-12"
        style={{
          backgroundImage: 'url(https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800)',
        }}
      >
        <div className="bg-primary/80 backdrop-blur-sm rounded-3xl p-10 text-white max-w-md">
          <Sparkles className="w-12 h-12 mb-6" />
          <h2 className="font-heading text-3xl font-bold mb-4">Find Your Perfect Space</h2>
          <p className="text-emerald-100 text-lg">
            Homes, Businesses, Hotels, Event Venues & Services - All in one platform
          </p>
          <div className="mt-8 flex items-center gap-4">
            <div className="text-center">
              <p className="text-3xl font-bold">10K+</p>
              <p className="text-emerald-200 text-sm">Properties</p>
            </div>
            <div className="w-px h-12 bg-white/30" />
            <div className="text-center">
              <p className="text-3xl font-bold">5K+</p>
              <p className="text-emerald-200 text-sm">Owners</p>
            </div>
            <div className="w-px h-12 bg-white/30" />
            <div className="text-center">
              <p className="text-3xl font-bold">4.8</p>
              <p className="text-emerald-200 text-sm">Rating</p>
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (activeTab === 'owner') {
        await registerOwner(formData);
        toast.success('Owner registration successful! Your account is pending Aadhar verification.');
        navigate('/owner/dashboard');
      } else {
        await register(formData);
        toast.success('Registration successful!');
        navigate('/dashboard');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const selectedOwnerType = ownerTypes.find(t => t.value === formData.role);

  return (
    <div className="min-h-screen flex" data-testid="register-page">
      {/* Left Side - Image */}
      <div
        className="hidden lg:flex w-2/5 bg-cover bg-center flex-col justify-end p-12"
        style={{
          backgroundImage: 'url(https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800)',
        }}
      >
        <div className="bg-stone-900/80 backdrop-blur-sm rounded-2xl p-8 text-white">
          <h2 className="font-heading text-3xl font-bold mb-4">Join GharSetu</h2>
          <p className="text-stone-300">
            {activeTab === 'owner' 
              ? 'List your properties, hotels, venues, or services and reach millions of users across Gujarat.'
              : 'Find your perfect home, book stays, discover event venues, and hire trusted service providers.'}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {['Verified Owners', 'Direct Chat', 'Easy Booking', 'Price Negotiation'].map((feature) => (
              <span key={feature} className="px-3 py-1 bg-white/10 rounded-full text-sm">
                {feature}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="flex-1 flex items-center justify-center p-8 overflow-y-auto">
        <div className="w-full max-w-lg">
          <Link to="/" className="flex items-center gap-2 mb-8">
            <img
              src="/GruvoraLogo.jpeg"
              alt="Gruvora"
              className="w-10 h-10 rounded-xl object-cover"
            />
            <span className="font-heading font-bold text-2xl text-primary">Gruvora</span>
          </Link>

          <h1 className="font-heading text-3xl font-bold text-stone-900 mb-2">Create Account</h1>
          <p className="text-muted-foreground mb-6">Register to explore properties and services</p>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
            <TabsList className="grid w-full grid-cols-2 h-12">
              <TabsTrigger value="user" className="data-[state=active]:bg-primary data-[state=active]:text-white" data-testid="tab-user">
                <User className="w-4 h-4 mr-2" />
                User
              </TabsTrigger>
              <TabsTrigger value="owner" className="data-[state=active]:bg-primary data-[state=active]:text-white" data-testid="tab-owner">
                <Shield className="w-4 h-4 mr-2" />
                Owner / Provider
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="name"
                    placeholder="Enter full name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="pl-12 h-12"
                    required
                    data-testid="register-name-input"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="phone"
                    placeholder="Enter phone number"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="pl-12 h-12"
                    required
                    data-testid="register-phone-input"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="pl-12 h-12"
                  required
                  data-testid="register-email-input"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Create a password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="pl-12 pr-12 h-12"
                  required
                  data-testid="register-password-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Gender</Label>
              <RadioGroup
                value={formData.gender}
                onValueChange={(value) => setFormData({ ...formData, gender: value })}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="male" id="male" />
                  <Label htmlFor="male" className="font-normal">Male</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="female" id="female" />
                  <Label htmlFor="female" className="font-normal">Female</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="other" id="other" />
                  <Label htmlFor="other" className="font-normal">Other</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Select value={formData.city} onValueChange={(value) => setFormData({ ...formData, city: value })}>
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Select city" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Surat">Surat</SelectItem>
                    <SelectItem value="Ahmedabad">Ahmedabad</SelectItem>
                    <SelectItem value="Vadodara">Vadodara</SelectItem>
                    <SelectItem value="Rajkot">Rajkot</SelectItem>
                    <SelectItem value="Gandhinagar">Gandhinagar</SelectItem>
                    <SelectItem value="Bhavnagar">Bhavnagar</SelectItem>
                    <SelectItem value="Jamnagar">Jamnagar</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="address"
                    placeholder="Area, Landmark"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="pl-12 h-12"
                    required
                    data-testid="register-address-input"
                  />
                </div>
              </div>
            </div>

            {/* Owner-specific fields */}
            {activeTab === 'owner' && (
              <>
                <Card className="border-secondary/30 bg-secondary/5">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-base">Select Owner Type</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-3">
                      {ownerTypes.map((type) => {
                        const Icon = type.icon;
                        const isSelected = formData.role === type.value;
                        return (
                          <button
                            key={type.value}
                            type="button"
                            onClick={() => setFormData({ ...formData, role: type.value })}
                            className={`p-4 rounded-xl border-2 text-left transition-all ${
                              isSelected
                                ? 'border-secondary bg-secondary/10'
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
                  </CardContent>
                </Card>

                <Card className="border-primary/30 bg-primary/5">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Shield className="w-5 h-5 text-primary" />
                      Aadhar Verification
                    </CardTitle>
                    <CardDescription>Required for trust & verification badge</CardDescription>
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
                          onChange={(e) => setFormData({ ...formData, aadhar_number: e.target.value })}
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
                        onChange={(e) => setFormData({ ...formData, aadhar_name: e.target.value })}
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
                        onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
                        className="h-12"
                      />
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            <Button type="submit" className="w-full btn-primary h-12" disabled={loading} data-testid="register-submit-btn">
              {loading ? 'Creating Account...' : activeTab === 'owner' ? 'Register as Owner' : 'Create Account'}
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
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
