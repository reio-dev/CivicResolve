# CivicResolv Design Guidelines

## Design Philosophy
Create a fintech-inspired civic engagement platform with modern, vibrant UI patterns. The design should feel premium, trustworthy, and engaging—similar to modern payment and financial apps.

## Color System

### Primary Palette
- **Primary Gradient**: Deep Blue (#1E40AF) to Purple (#7C3AED)
  - Use for hero sections, primary buttons, and key branding elements
  - Apply gradient backgrounds with subtle animations
- **Success/Action**: Green (#10B981)
  - Issue resolution confirmations, success states, verified badges
- **Warning/Urgent**: Orange (#F59E0B)
  - High priority issues, urgent notifications, SLA alerts
- **Background**: Clean whites and light grays (#F9FAFB)
  - Main app background, card backgrounds
- **Text**: Dark gray (#374151) for primary text, white for text on dark backgrounds

### Component Colors
- Status badges: Reported (Blue), Verified (Green), Assigned (Purple), In Progress (Orange), Resolved (Green)
- Validation actions: Verified (Green ✓), Invalid (Red ❌), Unclear (Orange ⚠️)

## Typography

### Hierarchy
- **Headers**: Bold, sans-serif, 18-24px
  - Screen titles, section headers, hero text
- **Body Text**: Regular weight, 14-16px
  - Descriptions, comments, standard content
- **Buttons**: Medium weight, clear calls-to-action
  - All-caps for primary actions, sentence case for secondary
- **Captions**: 12-14px
  - Timestamps, metadata, helper text

## UI Components & Patterns

### Cards
- **Border Radius**: 8-12px on all cards
- **Shadows**: Subtle drop shadows for depth
- **Spacing**: 16px padding inside cards, 12-16px margins between cards
- **Layout**: Card-based design throughout—issue cards, stat cards, action cards

### Buttons
- **Primary**: Gradient background (blue-purple), white text, rounded corners
- **Secondary**: White background, colored border, colored text
- **Floating Action Button**: Prominent primary action, gradient fill, drop shadow
- **States**: Include hover, pressed (scale down slightly), loading (spinner), disabled (reduced opacity)

### Icons
- Use @expo/vector-icons (Feather icon set preferred)
- Icon sizes: 20-24px for navigation, 16-20px for inline elements
- Tab bar icons: Camera, Grid, Users, Activity, User

### Forms & Inputs
- **Text Inputs**: Rounded corners, subtle border, focus state with colored border
- **Dropdowns/Pickers**: Bottom sheet modal for category/priority selection
- **Image Upload**: Gallery grid with add button, image preview with remove option
- **Voice Input**: Microphone button integrated into description field

## Screen Specifications

### Home/Dashboard
- **Header**: Transparent with app logo (left), notification bell (right), no back button
- **Hero Section**: Full-width gradient card with "Tap to Report" QR-style scanner interface, pulsing animation
- **Quick Stats Row**: Horizontal scroll of metric cards showing Issues Reported, Points Earned, Resolution Rate
- **Action Grid**: 2x2 grid below stats with icon + label cards
- **Recent Activity**: Scrollable vertical list of latest updates with timestamps
- **Safe Area**: Top inset = headerHeight + 20px, Bottom inset = tabBarHeight + 20px

### Report Issue Workflow
- **Camera Screen**: Full-screen camera with capture button (center bottom), gallery access (bottom left), flash toggle (top right)
  - Overlay guidelines showing photo framing suggestions
- **Location Screen**: Map view with draggable pin, address confirmation, "Use Current Location" button
- **Details Form**: Scrollable form with category selector (chips/cards), title input, description textarea with voice button, priority selector
  - Submit button in header (right), cancel in header (left)
- **Success Screen**: Centered checkmark animation, tracking number, "View Progress" button

### Community Validation
- **Feed Layout**: Card-based vertical scroll with issue cards
- **Issue Card**: Image gallery (swipeable), category badge (top-left), distance indicator, title, description preview
- **Validation Buttons**: Row of three buttons below each card - Verified (green), Invalid (red), Unclear (orange)
- **Filter Header**: Category chips, distance slider, date range in collapsible section
- **Safe Area**: Top inset = 20px, Bottom inset = tabBarHeight + 20px

### Tracking Dashboard
- **Timeline View**: Vertical timeline with connected dots showing status progression
- **Status Cards**: Expandable cards for each status stage with timestamp, photos, government notes
- **Progress Indicator**: Circular progress or horizontal bar showing percentage complete
- **SLA Timer**: Countdown badge showing time remaining for resolution
- **Safe Area**: Standard with tab bar inset

### Profile & Rewards
- **Profile Section**: Avatar (circular), name, civic level badge, total points
- **Stats Grid**: 2x2 grid showing Reports Submitted, Issues Resolved, Community Validations, Badges Earned
- **Leaderboard**: List of top contributors with rank, avatar, name, points
- **Achievement Cards**: Horizontal scroll of unlocked/locked badges with descriptions
- **Settings Button**: Header right, opens settings modal

## Navigation Architecture

### Tab Bar (Bottom)
- **5 Tabs**: Report, Issues, Community, Track, Profile
- **Active State**: Gradient icon color, label visible
- **Inactive State**: Gray icon, label hidden or subtle
- **Position**: Fixed bottom, translucent background with blur
- **Height**: 65-75px including safe area

### Screen Transitions
- **Tab Change**: Cross-fade between screens
- **Modal Screens**: Slide up from bottom (report flow, settings)
- **Navigation Stack**: Push/pop with slide from right

## Animations & Micro-interactions

### Using React Native Reanimated

**Hero Section**
- Pulsing "Tap to Report" button: Scale 1.0 → 1.1 with repeat, 1000ms duration
- Gradient background: Subtle shift using interpolation

**Button Press**
- Scale down to 0.95 with spring physics on press
- Scale back to 1.0 on release
- Add ripple effect for visual feedback

**List Entry**
- Issue cards fade in with stagger (100ms delay per item)
- Use FadeIn.delay(index * 100).duration(400)

**Success Animations**
- Checkmark scales from 0 to 1 with spring (damping: 10)
- Rotate 0 → 360 degrees over 800ms
- Confetti or particle effect optional

**Pull-to-Refresh**
- Custom spring animation for refresh indicator
- Rotate icon during refresh

**Swipe Gestures**
- Swipe left/right on issue cards for quick validation
- Animate card translation with pan gesture
- Snap back if swipe incomplete, fade out if validated

**Loading States**
- Skeleton screens with shimmer effect (gradient animation left to right)
- Rotating spinner for buttons during submission

**Progress Indicators**
- Animated progress bar with smooth timing (500-800ms)
- Circular progress with stroke animation

## Interactive Elements

### Gamification
- **Point Pop-ups**: Animated +10, +25 badges appear on action completion
- **Badge Unlock**: Modal with badge animation (scale + rotate)
- **Progress Bars**: Smooth fill animation when viewing stats
- **Streak Counter**: Flame icon with day count, glow effect

### Gestures
- **Swipe**: Left/right on issue cards for validation
- **Pull-to-Refresh**: All list screens
- **Pinch-to-Zoom**: Image galleries
- **Long Press**: Context menus on issue cards

## Accessibility

- Minimum touch target: 44x44px
- Color contrast ratio: 4.5:1 for text
- Screen reader support for all interactive elements
- Alternative text for images
- Dynamic type support

## Responsive Design

- Support for various screen sizes (small phones to tablets)
- Flexible grid systems (2 columns on small, 3-4 on tablets)
- Safe area insets respected throughout
- Landscape mode considerations for camera

## Performance

- Image optimization before upload
- Lazy loading for image galleries
- Virtualized lists for long feeds
- Animations run on UI thread (Reanimated)
- Offline queue for report submission