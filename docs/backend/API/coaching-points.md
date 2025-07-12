← [Back to API Overview](../../api-readme.md)

# Coaching Points API

## API Overview
Manages coaching points for video analysis, including creation, retrieval, and deletion of coaching feedback with associated metadata like tagged players, labels, and events.

## Base URL
`/api/coaching-points`

## Authentication Requirements
- All endpoints require Bearer token authentication
- Only coaches can create and manage coaching points

## Endpoints Table

| Method | Endpoint | Description | Auth Required | Roles |
|--------|----------|-------------|---------------|-------|
| POST | [`/`](#post-) | Create new coaching point | Yes | Coach |
| GET | [`/game/:gameId`](#get-gamegameid) | Get coaching points for game | Yes | Team Members |
| DELETE | [`/:id`](#delete-id) | Delete coaching point | Yes | Coach, Point Author |

## Detailed Route Documentation

### POST `/`
Create a new coaching point for a game.

**Parameters:**
- Body: Coaching point creation data

**Request Body Schema:**
```json
{
  "game_id": "uuid (required)",
  "author_id": "uuid (optional, defaults to authenticated user)",
  "title": "string (required)",
  "feedback": "string (required)",
  "timestamp": "number (required, milliseconds)",
  "audio_url": "string (optional, default: empty string)",
  "duration": "number (optional, default: 0, milliseconds)"
}
```

**Response Schema:**
```json
{
  "id": "uuid",
  "game_id": "uuid",
  "author_id": "uuid",
  "title": "string",
  "feedback": "string",
  "timestamp": "number",
  "audio_url": "string",
  "duration": "number",
  "created_at": "timestamp"
}
```

**Authentication/Role Requirements:**
- Bearer token required
- User must be Coach of the game's team
- Author ID automatically set to authenticated user

**Error Responses:**
- `400` - Missing required fields (game_id, title, timestamp)
- `401` - User not authenticated
- `403` - Only coaches can create coaching points
- `404` - Game not found or access denied
- `500` - Internal server error

**Business Logic Notes:**
- Verifies user has coach role in the game's team
- Author ID is overridden with authenticated user's ID for security
- Timestamp represents milliseconds in the video
- Audio URL typically points to Supabase storage

### GET `/game/:gameId`
Get all coaching points for a specific game with related data.

**Parameters:**
- Path: `gameId` (UUID) - Game ID to get coaching points for

**Request Body Schema:**
- None

**Response Schema:**
```json
[
  {
    "id": "uuid",
    "game_id": "uuid",
    "author_id": "uuid",
    "title": "string",
    "feedback": "string",
    "timestamp": "number",
    "audio_url": "string",
    "duration": "number",
    "created_at": "timestamp",
    "author": {
      "id": "uuid",
      "name": "string",
      "email": "string"
    },
    "coaching_point_tagged_players": [
      {
        "id": "uuid",
        "player_profiles": {
          "id": "uuid",
          "name": "string",
          "jersey_number": "string"
        }
      }
    ],
    "coaching_point_labels": [
      {
        "id": "uuid",
        "labels": {
          "id": "uuid",
          "name": "string"
        }
      }
    ],
    "coaching_point_events": [
      {
        "id": "uuid",
        "event_type": "play|pause|seek|draw|change_speed|recording_start",
        "timestamp": "number",
        "event_data": "object",
        "created_at": "timestamp"
      }
    ]
  }
]
```

**Authentication/Role Requirements:**
- Bearer token required
- User must be member of the game's team

**Error Responses:**
- `401` - User not authenticated
- `404` - Game not found or access denied
- `500` - Failed to fetch coaching points

**Business Logic Notes:**
- Returns comprehensive coaching point data with all relationships
- Includes author information for each coaching point
- Tagged players include player profile details
- Labels include label names
- Events include complete event data for playback
- Ordered by creation date (most recent first)

### DELETE `/:id`
Delete a coaching point and all associated data.

**Parameters:**
- Path: `id` (UUID) - Coaching point ID to delete

**Request Body Schema:**
- None

**Response Schema:**
- `204 No Content` (empty response body)

**Authentication/Role Requirements:**
- Bearer token required
- User must be either:
  - The author of the coaching point, OR
  - A coach in the game's team

**Error Responses:**
- `401` - User not authenticated
- `403` - Only author or coaches can delete coaching points
- `404` - Coaching point not found or access denied
- `500` - Failed to delete coaching point

**Business Logic Notes:**
- Cascading deletion removes all related data:
  - coaching_point_events
  - coaching_point_tagged_players
  - coaching_point_labels
  - coaching_point_views
- Verifies user permissions before deletion
- Returns 204 status on successful deletion
- Irreversible operation
