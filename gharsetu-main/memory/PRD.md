# GharSetu v2.0 - Product Requirements Document

## Project Overview
**Name:** GharSetu  
**Version:** 2.0.0  
**Tagline:** Find Your Perfect Space  
**Domain:** Full-scale Real Estate & Services Marketplace  
**Target Market:** Gujarat, India

## Original Problem Statement
Build a comprehensive startup platform combining:
- Real Estate Marketplace (Residential & Commercial)
- Hotel/Stay Booking System
- Event Venue Booking
- Home Services Marketplace
- Social Media Style Property Reels Platform

## Technology Stack
- **Frontend:** React.js + Tailwind CSS + Shadcn UI
- **Backend:** FastAPI (Python) with WebSocket support
- **Database:** MongoDB
- **AI Chatbot:** GPT-5.2 via Emergent LLM Key
- **Voice Search:** Web Speech API

## User Roles (6 Types)
1. **Normal User** - Browse, search, book, wishlist
2. **Property Owner** - List residential & commercial properties
3. **Service Provider** - Offer home services (plumber, electrician, etc.)
4. **Hotel Owner** - List hotels, rooms, guest houses
5. **Event Venue Owner** - List party plots, marriage halls, banquets
6. **Admin** - Full platform control

## Core Features Implemented

### Authentication System
- [x] User registration (name, email, phone, gender, address, city)
- [x] Owner registration with role selection
- [x] Aadhar card verification for owners
- [x] JWT authentication with token refresh
- [x] Multiple Gujarat cities support
- [x] Email verification tokens

### 5 Category System with Detailed Subcategories

#### 1. Home (ઘર)
- 1 BHK, 2 BHK, 3 BHK, 4+ BHK
- Row House, Duplex, Bungalow, Penthouse
- Residential Plot, Farmhouse, PG/Hostel, Villa

#### 2. Business (બિઝનેસ)
- Shops (Retail, Mall, Street, Showroom)
- Offices (Corporate, Small, Co-working, IT)
- Industrial (Warehouse, Godown, Factory)
- Food (Restaurant, Cafe, Cloud Kitchen)

#### 3. Stay (રહેવાનું)
- Hotels (Budget, Luxury)
- Rooms, Guest Houses
- Resorts, PG Accommodation, Homestay

#### 4. Event (ઇવેન્ટ)
- Party Plots
- Marriage Halls, Banquet Halls
- Conference Halls, Farmhouse Venues
- Hotel Venues, Outdoor Venues

#### 5. Services (સેવાઓ)
- Repair (Plumber, Electrician, AC, Washing Machine, RO, CCTV)
- Cleaning (Home, Bathroom, Sofa)
- Home Improvement (Painting, False Ceiling, Tile Work)
- Utility (Pest Control, Garden, Packers & Movers)

### Listing Features
- [x] Create/Read/Update/Delete listings
- [x] Image and video support
- [x] Price history tracking
- [x] View/Like/Save counters
- [x] Boost listing feature
- [x] Admin approval workflow
- [x] Nearby facilities
- [x] Map coordinates support
- [x] Verified owner badge

### Booking System
- [x] Date-based booking
- [x] Check-in/Check-out for stays
- [x] Guest count
- [x] Special requests
- [x] Status workflow (Pending/Confirmed/Cancelled/Completed)

### Negotiation System
- [x] Send price offers
- [x] Owner can Accept/Reject/Counter
- [x] Negotiation history tracking
- [x] Notifications on responses

### Visit Scheduling
- [x] Schedule property visits
- [x] In-person or video visit options
- [x] Date and time selection

### GharSetu Reels
- [x] Instagram-style vertical video feed
- [x] Scroll to navigate
- [x] Like, save, share functionality
- [x] View counter
- [x] Owner video uploads

### AI Chatbot
- [x] GPT-5.2 powered assistant
- [x] Property search help
- [x] Multilingual (Gujarati, Hindi, English)
- [x] Session-based conversations

### Voice Search
- [x] Web Speech API integration
- [x] Natural language queries
- [x] Parse location and property type

### Real-time Features
- [x] WebSocket foundation
- [x] Message system with conversations
- [x] Auto-reply for owners
- [x] Notification system

### Dashboards
- **User Dashboard:** Bookings, Wishlist, Saved Reels, Chatbot
- **Owner Dashboard:** Listings, Stats, Bookings, Negotiations, Analytics, Reels
- **Admin Dashboard:** Users, Listings, Bookings, Stats, Approvals, Aadhar Verification

## API Endpoints (70+)

### Auth
- POST /api/auth/register
- POST /api/auth/register/owner
- POST /api/auth/login
- GET /api/auth/me
- PUT /api/auth/profile
- GET /api/auth/verify/{token}

### Listings
- GET/POST /api/listings
- GET /api/listings/trending
- GET /api/listings/recommended
- GET /api/listings/nearby
- GET /api/listings/map
- GET /api/listings/heatmap
- GET /api/listings/{id}
- GET /api/listings/{id}/price-history
- PUT/DELETE /api/listings/{id}
- POST /api/listings/{id}/like
- POST /api/listings/{id}/share
- POST /api/listings/boost

### Bookings
- POST /api/bookings
- GET /api/bookings
- GET /api/bookings/owner
- PUT /api/bookings/{id}/status

### Visits
- POST /api/visits/schedule
- GET /api/visits
- GET /api/visits/owner

### Negotiations
- POST /api/negotiations
- PUT /api/negotiations/{id}/respond
- GET /api/negotiations
- GET /api/negotiations/owner

### Reviews
- POST /api/reviews
- GET /api/reviews/listing/{id}

### Videos/Reels
- GET/POST /api/videos
- GET /api/videos/feed
- POST /api/videos/{id}/like
- POST /api/videos/{id}/save
- GET /api/videos/saved

### Messages
- POST /api/messages
- GET /api/messages/conversations
- GET /api/messages/conversation/{id}

### Notifications
- GET /api/notifications
- PUT /api/notifications/{id}/read
- PUT /api/notifications/read-all

### Chat
- POST /api/chat
- POST /api/chat/voice

### Admin
- GET /api/admin/users
- GET /api/admin/listings
- PUT /api/admin/listings/{id}/status
- PUT /api/admin/users/{id}/verify-aadhar
- GET /api/admin/bookings
- GET /api/admin/stats

### Owner
- GET /api/owner/listings
- GET /api/owner/stats
- GET /api/owner/analytics

## Database Collections
- users
- listings
- bookings
- visits
- negotiations
- reviews
- videos
- conversations
- messages
- notifications

## Implementation Timeline

### Date: 2026-03-12
- ✅ Enhanced backend with 70+ API endpoints
- ✅ Multiple owner roles (4 types)
- ✅ Detailed subcategories for all 5 sections
- ✅ Negotiation system
- ✅ Visit scheduling
- ✅ Price history tracking
- ✅ Boost listing feature
- ✅ Notification system
- ✅ Message system foundation
- ✅ Voice search integration
- ✅ Owner analytics
- ✅ Enhanced UI with animations
- ✅ Fixed CategoryPage.js crash (Radix Select empty value bug)
- ✅ All 5 category pages fully functional with filters

### Date: 2026-03-12 (Session 2)
- ✅ AI Chatbot with GPT-5.2 (Emergent LLM Key) - Gujarati responses
- ✅ Instagram-style Reels page with Like/Save/Share
- ✅ Enhanced voice search modal (Web Speech API, Gujarati support)
- ✅ Direct Chat component for User-Owner messaging
- ✅ Payment Modal UI (Card/UPI/Net Banking - MOCKED)
- ✅ Framer-Motion animations throughout app
- ✅ Enhanced hero section with floating cards
- ✅ Animated category cards
- ✅ All 12 listings displaying across categories

### Date: 2026-03-12 (Session 3) - Major Fixes & Improvements
- ✅ **Homepage Category Filter Tabs** - Home, Business, Stay, Event, Services
- ✅ **Voice Search Fixed** - Button click properly opens modal
- ✅ **Chatbot Improved** - Better structure, Vaanix.in branding added
- ✅ **Razorpay Payment Integration** - Real test keys working (rzp_test_SJsbOORnwWigFu)
- ✅ **Payment API Bug Fixed** - get_current_user parameter fix
- ✅ **Mobile Responsive** - Homepage, Reels, Chatbot all work on 375px
- ✅ **Listing Page** - "Book & Pay Now" button for Stay/Event/Services
- ✅ **Homepage Search** - Now redirects to correct category with filters

### Date: 2026-03-12 (Session 4) - Instagram-Style Reels Complete
- ✅ **Reels Completely Rewritten** - Exact Instagram-style UI
- ✅ **Like Button** - Working with double-tap support
- ✅ **Save Button** - Working, saved to user collection
- ✅ **Share Button** - Copies link or uses native share
- ✅ **Follow Button** - Follow/unfollow owner
- ✅ **Comment System** - Modal with add/view comments
- ✅ **Reel Upload Modal** - Title, caption, category, hashtags, location
- ✅ **Video Progress Bar** - Shows playback progress
- ✅ **Music Track Info** - Instagram-style scrolling text
- ✅ **Owner Profile Gradient** - Pink/purple/orange border like Instagram
- ✅ **Hidden Contact Info** - "Contact via chat only" message on listings
- ✅ **WhatsApp-Style Chat** - Removed call/video buttons, text only
- ✅ **Chat Input Fixed** - Full width, h-11 height, properly visible
- ✅ **Platform Fee 5%** - Updated from 2% to 5%
- ✅ **Comments API** - GET/POST/DELETE endpoints added
- ✅ **Follow API** - Follow/unfollow endpoints added

### Date: 2026-03-12 (Session 5) - Voice Search Fix & Saved Reels
- ✅ **Voice Search Button Fixed** - Robust event handling (stopImmediatePropagation, mousedown/touchstart handlers, z-index)
- ✅ **Saved Reels Section** - New tab in User Dashboard with SavedReelCard component
- ✅ **Saved Reels Display** - Shows video thumbnail, title, views, likes
- ✅ **Remove Saved Reel** - Trash icon button removes video from saved list
- ✅ **Comments API Added** - getComments, addComment, deleteComment in api.js
- ✅ **Test Coverage** - iteration_9.json - 100% pass rate

### Date: 2026-03-12 (Session 6) - Owner Profile & Map Integration
- ✅ **Owner Profile Page** - Instagram-style public profile (/owner/:ownerId)
- ✅ **Profile Stats** - Shows reels count, listings count, followers, following
- ✅ **Reels/Listings Tabs** - Grid view for owner's content
- ✅ **Follow/Message Buttons** - Social interaction with owners
- ✅ **Map Search Page** - Full map-based property search (/map)
- ✅ **OpenStreetMap Integration** - Free map tiles with Leaflet library
- ✅ **Category-Colored Markers** - Different colors for each property type
- ✅ **City Selector** - All Gujarat major cities (Surat, Ahmedabad, Vadodara, etc.)
- ✅ **Map/List View Toggle** - Switch between map and list views
- ✅ **Header Map Button** - Blue "Map" button in navigation
- ✅ **Test Coverage** - iteration_10.json - 100% pass rate

### Date: 2026-03-12 (Session 7) - Local File Upload with Cloudinary
- ✅ **Image Upload Endpoint** - POST /api/upload/image (single image)
- ✅ **Multiple Images Upload** - POST /api/upload/images (max 10 images)
- ✅ **Video Upload Endpoint** - POST /api/videos/upload with auth
- ✅ **ImageUploader Component** - Drag-drop, preview, remove functionality
- ✅ **VideoUploader Component** - Video preview, file size validation (max 100MB)
- ✅ **Owner Dashboard Integration** - CreateListingForm uses ImageUploader
- ✅ **Reels Upload Integration** - Upload modal uses video file input
- ✅ **File Validation** - Image max 10MB, Video max 100MB, type checks
- ✅ **Cloudinary Integration** - Configured with fallback to demo mode
- ✅ **Test Coverage** - iteration_11.json - 100% pass rate (Backend 11/11, Frontend 100%)

### Date: 2026-03-12 (Session 8) - Mobile Responsiveness & Subscription API
- ✅ **Mobile Header Fixed** - Map & Reels buttons now visible on mobile
- ✅ **Mobile Bottom Navigation** - Added bottom nav with Home, Map, Reels, Profile icons
- ✅ **Mobile Map Page** - Map view works on mobile with markers and toggles
- ✅ **Owner Profile Reels Fix** - Fixed video_url vs url field issue, thumbnails now show
- ✅ **Service Provider Subscription API** - ₹251/month subscription system
  - POST /api/subscriptions/create-order (Razorpay order)
  - POST /api/subscriptions/verify (Payment verification)
  - GET /api/subscriptions/status (Check subscription)
- ✅ **Role-based Access** - Only service_provider role can subscribe
- ✅ **Test Coverage** - iteration_12.json - 100% pass rate

### Date: 2026-03-12 (Session 9) - Owner Dashboard Features
- ✅ **Subscription UI** - ₹251/month card with crown icon and features list
  - Priority in search results
  - Verified badge on profile
  - See full customer contact details
  - Advanced analytics dashboard
  - Boost your listings
  - Direct customer inquiries
- ✅ **Analytics Section** - Stats cards (Views, Inquiries, Revenue, Likes)
  - Weekly Performance bar chart (Mon-Sun)
  - Top Performing Listings section
- ✅ **Leads Management** - Customer inquiries list
  - Premium upgrade banner for non-subscribed users
  - Contact details (blurred for non-premium)
  - Call, Email, Chat buttons
- ✅ **Sidebar Navigation** - Added Analytics, Leads, Subscription tabs
- ✅ **Test Coverage** - iteration_13.json - 100% pass rate

### Date: 2026-03-12 (Session 10) - Mobile Header Fix & Admin Panel
- ✅ **Mobile Header Cleanup** - Map/Reels buttons hidden on mobile (use bottom nav)
- ✅ **Mobile Bottom Navigation** - Home, Map, Reels icons for quick access
- ✅ **Admin Dashboard** - Full admin panel with stats and management
  - Stats Overview: Users, Listings, Bookings, Videos counts
  - Listings by Category: Home, Business, Stay, Event, Services
  - Users Tab: User table with roles and verification status
  - Aadhar Verification: Pending badge + Verify button for owners
  - Listings Tab: Approve/Reject functionality
- ✅ **Test Coverage** - iteration_14.json - 100% pass rate

## Pending Features (Need API Keys)

### P0 - Need User Keys
- [ ] Google Maps API integration
- [ ] Razorpay payment gateway (test keys not available)
- [ ] Firebase real-time notifications

### P1 - Future Enhancements
- [ ] 360° Virtual tours
- [ ] Live property tours (video streaming)
- [ ] Property heatmap visualization
- [ ] ElasticSearch for advanced search
- [ ] Push notifications (FCM)
- [ ] Image/video upload to cloud storage

### P2 - Mobile & Advanced
- [ ] React Native mobile app
- [ ] Property comparison tool
- [ ] AI-based price prediction
- [ ] Investment hotspot analysis

## Next Steps
1. **Real-time Notifications** - Socket.io for chat and booking alerts
2. **AI Property Recommendation** - Based on user behavior
3. **Boost Listing Feature** - Paid promotion for listings
4. **ElasticSearch Integration** - Better search with filters
