# TACTIX Frontend Architecture

This document provides a comprehensive overview of the TACTIX frontend architecture using Mermaid diagrams.

## Table of Contents
1. [High-Level Component Architecture](#high-level-component-architecture)
2. [Component Hierarchy & Composition](#component-hierarchy--composition)
3. [Data Flow Architecture](#data-flow-architecture)
4. [State Management](#state-management)
5. [Drawing System Architecture](#drawing-system-architecture)
6. [Video Analysis Flow](#video-analysis-flow)
7. [Authentication Flow](#authentication-flow)
8. [API Integration](#api-integration)

## High-Level Component Architecture

```mermaid
graph TB
    subgraph "Entry Point"
        Main[main.tsx] --> App[App.tsx]
    end
    
    subgraph "Provider Layer"
        App --> AuthProvider[AuthProvider]
    end
    
    subgraph "Route Layer"
        AuthProvider --> Auth{Authenticated?}
        Auth -->|No| AuthComponent[Auth Component]
        Auth -->|Yes| Dashboard[Dashboard]
    end
    
    subgraph "Main Application"
        Dashboard --> Navigation
        Dashboard --> TeamManagement[Team Management]
        Dashboard --> GameManagement[Game Management]
        Dashboard --> UserProfile[User Profile]
        
        GameManagement --> GamesList
        GameManagement --> GameForm
        GameManagement --> GameAnalysis
    end
    
    subgraph "Game Analysis System"
        GameAnalysis --> VideoSystem[Video System]
        GameAnalysis --> DrawingSystem[Drawing System]
        GameAnalysis --> CoachingSystem[Coaching System]
        GameAnalysis --> RecordingSystem[Recording System]
    end
    
    style Main fill:#f9f,stroke:#333,stroke-width:4px
    style App fill:#f9f,stroke:#333,stroke-width:4px
    style Dashboard fill:#bbf,stroke:#333,stroke-width:2px
    style GameAnalysis fill:#bfb,stroke:#333,stroke-width:2px
```

## Component Hierarchy & Composition

```mermaid
graph TD
    App[App.tsx]
    App --> AuthProvider[AuthProvider Context]
    
    AuthProvider --> Auth[Auth Component]
    AuthProvider --> Dashboard[Dashboard Component]
    
    Dashboard --> Navigation[Navigation]
    Dashboard --> ThemeToggle[ThemeToggle]
    Dashboard --> UserProfile[UserProfile]
    Dashboard --> TeamsList[Teams List]
    Dashboard --> GamesList[GamesList]
    Dashboard --> GameForm[GameForm Modal]
    Dashboard --> GameAnalysis[GameAnalysis]
    
    GameAnalysis --> YouTubePlayer[YouTubePlayer]
    GameAnalysis --> DrawingCanvas[DrawingCanvas]
    GameAnalysis --> DrawingToolbar[DrawingToolbar]
    GameAnalysis --> CoachingPointsFlyout[CoachingPointsFlyout]
    GameAnalysis --> CoachingPointModal[CoachingPointModal]
    
    CoachingPointsFlyout --> TransportControl[TransportControl]
    
    style App fill:#f9f,stroke:#333,stroke-width:4px
    style Dashboard fill:#bbf,stroke:#333,stroke-width:2px
    style GameAnalysis fill:#bfb,stroke:#333,stroke-width:2px
```

## Data Flow Architecture

```mermaid
flowchart LR
    subgraph "Frontend Layer"
        UI[UI Components]
        Hooks[Custom Hooks]
        Context[Context Providers]
        Utils[Utility Functions]
    end
    
    subgraph "State Management"
        LocalState[Local Component State]
        AuthContext[Auth Context]
        RefState[useRef State]
    end
    
    subgraph "External Services"
        Supabase[Supabase Client]
        YouTube[YouTube API]
        Backend[Backend API]
    end
    
    UI --> Hooks
    Hooks --> Context
    Hooks --> Utils
    
    Context --> AuthContext
    Hooks --> LocalState
    Hooks --> RefState
    
    Context --> Supabase
    Hooks --> YouTube
    Utils --> Backend
    
    Backend --> |Teams/Games| UI
    Supabase --> |Auth| AuthContext
    YouTube --> |Video Control| UI
```

## State Management

```mermaid
graph TD
    subgraph "Global State"
        AuthContext[AuthContext<br/>- user<br/>- session<br/>- loading]
    end
    
    subgraph "Component State"
        Dashboard[Dashboard State<br/>- teams<br/>- selectedTeam<br/>- currentPage]
        
        GameAnalysis[GameAnalysis State<br/>- coachingPoints<br/>- selectedPoint<br/>- isRecording]
    end
    
    subgraph "Hook State with Refs"
        DrawingCanvas[useDrawingCanvas<br/>- drawingElementsRef<br/>- currentStrokeRef<br/>- isDrawingRef]
        
        YouTubePlayer[useYouTubePlayer<br/>- playerRef<br/>- isPlayingRef]
        
        Recording[useRecordingSession<br/>- eventsRef<br/>- startTimeRef]
    end
    
    AuthContext --> Dashboard
    Dashboard --> GameAnalysis
    GameAnalysis --> DrawingCanvas
    GameAnalysis --> YouTubePlayer
    GameAnalysis --> Recording
```

## Drawing System Architecture

```mermaid
flowchart TB
    subgraph "Drawing Input"
        DrawingToolbar[DrawingToolbar<br/>- Color Selection<br/>- Mode Selection<br/>- Clear Function]
        MouseEvents[Mouse/Touch Events]
    end
    
    subgraph "Drawing Hook"
        useDrawingCanvas[useDrawingCanvas Hook]
        DrawingState[Drawing State<br/>- currentColor<br/>- currentMode<br/>- drawingElements]
        DrawingMethods[Drawing Methods<br/>- startDrawing<br/>- draw<br/>- stopDrawing]
    end
    
    subgraph "Canvas Rendering"
        DrawingCanvas[DrawingCanvas Component]
        CanvasRef[Canvas Ref]
        DrawingRenderer[drawingRenderer.ts<br/>- drawElement<br/>- drawStroke<br/>- drawRectangle<br/>- drawEllipse]
    end
    
    subgraph "Data Persistence"
        DrawingData[Drawing Data<br/>- Normalized Coordinates<br/>- Drawing Commands]
        API[API Utils<br/>- compressDrawingData]
    end
    
    DrawingToolbar --> useDrawingCanvas
    MouseEvents --> DrawingCanvas
    
    useDrawingCanvas --> DrawingState
    useDrawingCanvas --> DrawingMethods
    
    DrawingCanvas --> CanvasRef
    DrawingMethods --> DrawingRenderer
    DrawingRenderer --> CanvasRef
    
    DrawingState --> DrawingData
    DrawingData --> API
    
    style useDrawingCanvas fill:#bfb,stroke:#333,stroke-width:2px
    style DrawingRenderer fill:#fbf,stroke:#333,stroke-width:2px
```

## Video Analysis Flow

```mermaid
sequenceDiagram
    participant User
    participant GameAnalysis
    participant YouTubePlayer
    participant DrawingCanvas
    participant CoachingModal
    participant Backend
    
    User->>GameAnalysis: Select Game
    GameAnalysis->>YouTubePlayer: Load Video
    YouTubePlayer-->>GameAnalysis: Video Ready
    
    User->>YouTubePlayer: Play/Pause/Seek
    YouTubePlayer-->>GameAnalysis: Time Update
    
    User->>DrawingCanvas: Draw on Video
    DrawingCanvas-->>GameAnalysis: Drawing Data
    
    User->>GameAnalysis: Save Coaching Point
    GameAnalysis->>CoachingModal: Open Modal
    User->>CoachingModal: Add Details
    CoachingModal->>Backend: Save Point
    Backend-->>GameAnalysis: Update Points List
    
    User->>GameAnalysis: Review Point
    GameAnalysis->>YouTubePlayer: Seek to Timestamp
    GameAnalysis->>DrawingCanvas: Load Drawings
```

## Authentication Flow

```mermaid
flowchart TD
    Start([App Start]) --> CheckAuth{Check Auth Status}
    
    CheckAuth -->|Not Authenticated| AuthComponent[Auth Component]
    CheckAuth -->|Authenticated| Dashboard[Dashboard]
    
    AuthComponent --> SignIn[Sign In]
    AuthComponent --> SignUp[Sign Up]
    AuthComponent --> ForgotPassword[Forgot Password]
    
    SignIn --> Supabase{Supabase Auth}
    SignUp --> Supabase
    ForgotPassword --> Supabase
    
    Supabase -->|Success| SetSession[Set Session]
    Supabase -->|Error| ShowError[Show Error]
    
    SetSession --> UpdateContext[Update Auth Context]
    UpdateContext --> Dashboard
    
    ShowError --> AuthComponent
    
    Dashboard --> Logout[Logout Option]
    Logout --> ClearSession[Clear Session]
    ClearSession --> AuthComponent
    
    style Start fill:#f9f,stroke:#333,stroke-width:2px
    style Dashboard fill:#bfb,stroke:#333,stroke-width:2px
    style AuthComponent fill:#fbb,stroke:#333,stroke-width:2px
```

## API Integration

```mermaid
graph LR
    subgraph "Frontend Services"
        TeamAPI[Team API<br/>- fetchTeams<br/>- createTeam<br/>- updateTeam]
        GameAPI[Game API<br/>- fetchGames<br/>- createGame<br/>- updateGame]
        CoachingAPI[Coaching API<br/>- fetchPoints<br/>- createPoint<br/>- uploadDrawings]
    end
    
    subgraph "API Utils"
        APIUtils[api.ts<br/>- getApiUrl<br/>- uploadAudio<br/>- compressDrawingData]
        AuthHeaders[Auth Headers<br/>- Bearer Token]
    end
    
    subgraph "Backend Endpoints"
        TeamEndpoints[/api/teams]
        GameEndpoints[/api/games]
        CoachingEndpoints[/api/coaching-points]
        StorageEndpoints[/api/storage]
    end
    
    TeamAPI --> APIUtils
    GameAPI --> APIUtils
    CoachingAPI --> APIUtils
    
    APIUtils --> AuthHeaders
    
    AuthHeaders --> TeamEndpoints
    AuthHeaders --> GameEndpoints
    AuthHeaders --> CoachingEndpoints
    AuthHeaders --> StorageEndpoints
    
    style APIUtils fill:#fbf,stroke:#333,stroke-width:2px
```

## Hooks Architecture

```mermaid
graph TD
    subgraph "UI Hooks"
        useKeyboardShortcuts[useKeyboardShortcuts<br/>- Drawing shortcuts<br/>- Video control<br/>- Tool selection]
    end
    
    subgraph "Drawing Hooks"
        useDrawingCanvas[useDrawingCanvas<br/>- Canvas management<br/>- Drawing operations<br/>- Data persistence]
    end
    
    subgraph "Media Hooks"
        useYouTubePlayer[useYouTubePlayer<br/>- Player control<br/>- State tracking<br/>- Event handling]
        
        useAudioRecording[useAudioRecording<br/>- Audio capture<br/>- Blob generation<br/>- Duration tracking]
    end
    
    subgraph "Session Hooks"
        useRecordingSession[useRecordingSession<br/>- Event tracking<br/>- Session timing<br/>- Data compilation]
    end
    
    GameAnalysis --> useKeyboardShortcuts
    GameAnalysis --> useDrawingCanvas
    GameAnalysis --> useYouTubePlayer
    GameAnalysis --> useAudioRecording
    GameAnalysis --> useRecordingSession
    
    style GameAnalysis fill:#bfb,stroke:#333,stroke-width:2px
```

## Type System Overview

```mermaid
graph TD
    subgraph "Database Types"
        DatabaseTypes[database.ts<br/>- Tables<br/>- Enums<br/>- Functions]
    end
    
    subgraph "Domain Types"
        DrawingTypes[drawing.ts<br/>- Drawing<br/>- StrokeDrawing<br/>- ShapeDrawing]
        ConfigTypes[config.ts<br/>- CONFIG<br/>- DrawingMode]
    end
    
    subgraph "Component Props"
        GameProps[Game Interface]
        CoachingPointProps[CoachingPoint Interface]
        DrawingProps[Drawing Component Props]
    end
    
    DatabaseTypes --> Domain
    Domain --> DrawingTypes
    Domain --> ConfigTypes
    
    DrawingTypes --> DrawingProps
    DatabaseTypes --> GameProps
    DatabaseTypes --> CoachingPointProps
```

## CSS Architecture

```mermaid
graph TD
    subgraph "Global Styles"
        UIKit[ui-kit.css<br/>- CSS Variables<br/>- Theme System<br/>- Base Components]
        IndexCSS[index.css<br/>- Reset Styles<br/>- Body Modes<br/>- Root Styles]
    end
    
    subgraph "Component Styles"
        GameAnalysisCSS[GameAnalysis.css]
        DrawingToolbarCSS[DrawingToolbar.css]
        CoachingPointsCSS[CoachingPoints.css]
        DashboardCSS[Dashboard styles]
    end
    
    UIKit --> IndexCSS
    IndexCSS --> App
    
    App --> GameAnalysisCSS
    App --> DrawingToolbarCSS
    App --> CoachingPointsCSS
    App --> DashboardCSS
    
    style UIKit fill:#fbf,stroke:#333,stroke-width:2px
```