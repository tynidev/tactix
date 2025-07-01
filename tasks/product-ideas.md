tynidev: I want to create a web app that lets a coach annotate a youtube video of his team's last soccer game. Save those annotations (drawings over the video, voice recording, written notes) as notes for various players or the team as a whole. Then publish the game footage for the players to login and view. 

I'm toying with the idea of an annotation being called a 'markup' and the 'markup' containing the time in the video the markup started and all actions the coach took (ex: Play, Pause, Skip, Draw line, Draw square, voice recording the whole time). But I may just have a 'markup' be restricted to a paused point in the video and the completed drawings the coach input as well as text OR his voice recorded.

The site will need logins and it will need various user types/permissions.
- Coach: can create new game video and create list of markups for video
- Player: can view game footage/markups the coach has previously created for thier team

These are essentially very similar except the player won't be able to draw and create markups. But they can still navigate around the video with the same transport tools.

Help me bounce ideas and develop a product requirement spec of what this product is.

GitHub Copilot: This is a great concept for a sports analysis tool! Let me help you flesh out the product requirements. Based on your existing YouTube player integration, you're already on the right track. Here's a comprehensive product requirement spec:

## Product Name: TactiX (or similar sports analysis name)

### Core Concept
A web-based video annotation platform for soccer coaches to analyze game footage, create visual and audio annotations, and share insights with players for performance improvement.

### Key Design Decisions to Consider:

**1. Markup/Annotation Model:**
I'd recommend going with the **"timeline-based markup"** approach rather than just paused points:
- Each markup has a start time and duration
- Can contain multiple annotation types (drawings, voice, text)
- Players can see the coach's thought process in real-time
- More engaging for players to watch

**2. User Types & Permissions:**

````typescript
export enum UserRole {
  COACH = 'COACH',
  PLAYER = 'PLAYER',
  ADMIN = 'ADMIN', // For team management
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  teamIds: string[]; // Users can belong to multiple teams
  profileImage?: string;
}

export interface Team {
  id: string;
  name: string;
  coachIds: string[];
  playerIds: string[];
  seasonYear: number;
}
````

### Feature Specification:

**3. Core Features:**

**Coach Features:**
- Upload/link YouTube videos
- Drawing tools:
  - Freehand pen
  - Shapes (arrows, circles, rectangles)
  - Player movement paths
  - Text labels
- Voice recording synchronized with video timeline
- Text notes with timestamps
- Tag specific players in markups
- Organize markups by:
  - Game phases (offense, defense, set pieces)
  - Individual players
  - Team formations
- Publish/unpublish game analysis

**Player Features:**
- View team's game footage
- Filter markups by:
  - Personal tags only
  - Team-wide markups
  - Specific game phases
- Playback controls with markup overlay
- Comment on markups (optional)
- Download personal feedback summary

**4. Technical Architecture:**

````typescript
export interface Markup {
  id: string;
  videoId: string;
  coachId: string;
  startTime: number; // seconds
  endTime: number; // seconds
  annotations: Annotation[];
  taggedPlayerIds: string[];
  category: MarkupCategory;
  isPublished: boolean;
  createdAt: Date;
}

export interface Annotation {
  id: string;
  type: AnnotationType;
  timestamp: number; // relative to markup start
  data: DrawingData | AudioData | TextData;
}

export enum AnnotationType {
  DRAWING = 'DRAWING',
  AUDIO = 'AUDIO',
  TEXT = 'TEXT',
}

export enum MarkupCategory {
  OFFENSIVE_PLAY = 'OFFENSIVE_PLAY',
  DEFENSIVE_PLAY = 'DEFENSIVE_PLAY',
  SET_PIECE = 'SET_PIECE',
  INDIVIDUAL_SKILL = 'INDIVIDUAL_SKILL',
  TEAM_FORMATION = 'TEAM_FORMATION',
}

export interface DrawingData {
  tool: 'pen' | 'arrow' | 'circle' | 'rectangle' | 'text';
  color: string;
  strokeWidth: number;
  points: { x: number; y: number }[];
}
````

**5. User Experience Flow:**

**Coach Workflow:**
1. Login → Team Dashboard
2. Create New Game Analysis
3. Paste YouTube URL or upload video
4. Video loads with annotation toolbar
5. Play video, pause at key moments
6. Add annotations (draw, speak, type)
7. Tag relevant players
8. Save markup segment
9. Continue through video
10. Review all markups
11. Publish to team

**Player Workflow:**
1. Login → Personal Dashboard
2. See new game analyses available
3. Click to view game
4. See timeline with markup indicators
5. Play video with coach's annotations overlaid
6. Filter to see only personal markups
7. Take notes or acknowledge viewing

**6. Data Storage Considerations:**
- Video files: YouTube (already implemented)
- Drawings: SVG or Canvas data as JSON
- Audio: Compressed audio files (WebM/MP3)
- Database: PostgreSQL or MongoDB for flexibility
- File storage: AWS S3 or similar for audio files

**7. Additional Features to Consider:**
- **Analytics**: Track which players viewed their feedback
- **Mobile App**: For on-field review
- **Export**: PDF reports with key frames and notes
- **Comparison**: Side-by-side video comparison
- **Templates**: Reusable drawing templates for common plays

Would you like me to help you:
1. Design the database schema
2. Create the annotation overlay component
3. Build the drawing tools interface
4. Set up the authentication system
5. Plan the API endpoints

What aspect would you like to tackle first?