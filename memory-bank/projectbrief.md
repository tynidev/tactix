# TACTIX Project Brief

## Project Overview
TACTIX is a video-based coaching platform designed for youth sports teams. It allows coaches to upload game footage from YouTube and create interactive coaching sessions with time-synced feedback, drawings, and voice recordings. Players and guardians can access personalized coaching points specific to them.

## Core Requirements

### Primary Users
- **Coaches**: Create coaching content, manage teams, analyze game footage
- **Players**: View personalized coaching feedback, acknowledge learning
- **Guardians**: Monitor their children's coaching feedback, support learning
- **Admins**: Team management and oversight

### Essential Features
1. **Game Video Management**
   - Upload games via YouTube links
   - Input scores, locations, game types
   - Organize by teams and dates

2. **Interactive Coaching Points**
   - Create feedback at specific video timestamps
   - Voice recordings for detailed explanations
   - On-screen drawings (arrows, shapes, plays)
   - Player tagging for personalized feedback
   - Labels for categorization (e.g., "defense", "corner kicks")

3. **Team Management**
   - Role-based access (coach, player, admin, guardian)
   - Join codes for team enrollment
   - Guardian-child relationship management

4. **Recording Sessions**
   - Record entire coaching process including video controls and drawing sequences
   - Players can replay coaching sessions later
   - Event-based recording system for accurate playback

5. **Personalized Access**
   - Guardians see coaching feedback for their children
   - Players see their own tagged coaching points
   - Acknowledgment system for viewed content

## Technical Goals
- Responsive web application
- Real-time video synchronization
- Secure authentication and authorization
- Row-level security for data isolation
- Cloud-hosted with minimal maintenance overhead

## Success Metrics
- Coaches can efficiently create detailed game analysis
- Players engage with and acknowledge coaching feedback
- Guardians stay informed about their children's development
- Platform scales to support multiple teams simultaneously

## Constraints
- Must integrate with YouTube for video hosting
- Cloud deployment using free/low-cost tiers initially
- Mobile-responsive design essential
- Must comply with youth sports privacy requirements
