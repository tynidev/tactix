← [Back to API Overview](../../api-readme.md)

# Games API

## API Overview
Manages game creation, modification, and retrieval for teams. Handles game metadata including scores, videos, and team associations with role-based access control.

## Base URL
`/api/games`

## Authentication Requirements
- All endpoints require Bearer token authentication
- Role-based access control varies by endpoint

## Endpoints Table

| Method | Endpoint | Description | Auth Required | Roles |
|--------|----------|-------------|---------------|-------|
| GET | [`/`](#get-) | Get all games from user's teams | Yes | Team Members |
| POST | [`/`](#post-) | Create new game | Yes | Coach, Admin |
| GET | [`/team/:teamId`](#get-teamteamid) | Get games for specific team | Yes | Team Members |
| GET | [`/:gameId`](#get-gameid) | Get specific game details | Yes | Team Members |
| PUT | [`/:gameId`](#put-gameid) | Update game | Yes | Coach, Admin |
| DELETE | [`/:gameId`](#delete-gameid) | Delete game | Yes | Coach, Admin |

## Detailed Route Documentation

### GET `/`
Get all games from teams the authenticated user has access to.

**Parameters:**
- None (user ID extracted from JWT token)

**Request Body Schema:**
- None

**Response Schema:**
```json
[
  {
    "id": "uuid",
    "team_id": "uuid",
    "opponent": "string",
    "date": "date",
    "location": "string",
    "video_id": "string",
    "team_score": "number",
    "opp_score": "number",
    "game_type": "regular|tournament|scrimmage",
    "home_away": "home|away|neutral",
    "notes": "string",
    "created_at": "timestamp",
    "teams": {
      "id": "uuid",
      "name": "string"
    },
    "user_role": "coach|admin|player|guardian",
    "coaching_points_count": "number"
  }
]
```

**Authentication/Role Requirements:**
- Bearer token required
- Returns games from all teams user is a member of

**Error Responses:**
- `401` - User not authenticated
- `400` - Database query error

**Business Logic Notes:**
- Aggregates games from all user's teams
- Includes user's role for each game's team
- Includes coaching points count for each game
- Ordered by date (most recent first)

### POST `/`
Create a new game for a team.

**Parameters:**
- Body: Game creation data

**Request Body Schema:**
```json
{
  "team_id": "uuid (required)",
  "opponent": "string (required)",
  "date": "date (required)",
  "location": "string (optional)",
  "video_id": "string (optional)",
  "team_score": "number (optional)",
  "opp_score": "number (optional)",
  "game_type": "regular|tournament|scrimmage (optional, default: regular)",
  "home_away": "home|away|neutral (optional, default: home)",
  "notes": "string (optional)"
}
```

**Response Schema:**
```json
{
  "message": "Game created successfully",
  "game": {
    "id": "uuid",
    "team_id": "uuid",
    "opponent": "string",
    "date": "date",
    "location": "string",
    "video_id": "string",
    "team_score": "number",
    "opp_score": "number",
    "game_type": "regular|tournament|scrimmage",
    "home_away": "home|away|neutral",
    "notes": "string",
    "created_at": "timestamp"
  }
}
```

**Authentication/Role Requirements:**
- Bearer token required
- User must be Coach or Admin of the team

**Error Responses:**
- `400` - Missing required fields or invalid data
- `401` - User not authenticated
- `403` - User not coach or admin of team

**Business Logic Notes:**
- Automatically extracts YouTube video ID from full URLs
- Supports YouTube formats: youtube.com/watch?v= and youtu.be/
- Validates user has coach or admin role in specified team
- Sets default values for optional fields

### GET `/team/:teamId`
Get all games for a specific team.

**Parameters:**
- Path: `teamId` (UUID) - Team ID to get games for

**Request Body Schema:**
- None

**Response Schema:**
```json
[
  {
    "id": "uuid",
    "opponent": "string",
    "date": "date",
    "location": "string",
    "video_id": "string",
    "team_score": "number",
    "opp_score": "number",
    "game_type": "regular|tournament|scrimmage",
    "home_away": "home|away|neutral",
    "notes": "string",
    "created_at": "timestamp",
    "teams": {
      "id": "uuid",
      "name": "string"
    },
    "user_role": "coach|admin|player|guardian",
    "coaching_points_count": "number"
  }
]
```

**Authentication/Role Requirements:**
- Bearer token required
- User must be member of the specified team

**Error Responses:**
- `401` - User not authenticated
- `403` - User not member of team
- `400` - Database query error

**Business Logic Notes:**
- Returns user's role in the team
- Includes coaching points count for each game
- Ordered by date (most recent first)

### GET `/:gameId`
Get details for a specific game.

**Parameters:**
- Path: `gameId` (UUID) - Game ID to retrieve

**Request Body Schema:**
- None

**Response Schema:**
```json
{
  "id": "uuid",
  "team_id": "uuid",
  "opponent": "string",
  "date": "date",
  "location": "string",
  "video_id": "string",
  "team_score": "number",
  "opp_score": "number",
  "game_type": "regular|tournament|scrimmage",
  "home_away": "home|away|neutral",
  "notes": "string",
  "created_at": "timestamp",
  "teams": {
    "id": "uuid",
    "name": "string"
  },
  "coaching_points_count": "number"
}
```

**Authentication/Role Requirements:**
- Bearer token required
- User must be member of the game's team

**Error Responses:**
- `401` - User not authenticated
- `403` - Access denied (not team member)
- `404` - Game not found

**Business Logic Notes:**
- Verifies user has access to the game via team membership
- Includes coaching points count for the game

### PUT `/:gameId`
Update an existing game's information.

**Parameters:**
- Path: `gameId` (UUID) - Game ID to update
- Body: Game update data

**Request Body Schema:**
```json
{
  "opponent": "string (optional)",
  "date": "date (optional)",
  "location": "string (optional)",
  "video_id": "string (optional)",
  "team_score": "number (optional)",
  "opp_score": "number (optional)",
  "game_type": "regular|tournament|scrimmage (optional)",
  "home_away": "home|away|neutral (optional)",
  "notes": "string (optional)"
}
```

**Response Schema:**
```json
{
  "message": "Game updated successfully",
  "game": {
    "id": "uuid",
    "team_id": "uuid",
    "opponent": "string",
    "date": "date",
    "location": "string",
    "video_id": "string",
    "team_score": "number",
    "opp_score": "number",
    "game_type": "regular|tournament|scrimmage",
    "home_away": "home|away|neutral",
    "notes": "string",
    "created_at": "timestamp"
  }
}
```

**Authentication/Role Requirements:**
- Bearer token required
- User must be Coach or Admin of the game's team

**Error Responses:**
- `401` - User not authenticated
- `403` - User not coach or admin of team
- `404` - Game not found
- `400` - Invalid update data

**Business Logic Notes:**
- Automatically extracts YouTube video ID from full URLs
- Only updates provided fields (partial updates supported)
- Verifies user permissions before allowing updates

### DELETE `/:gameId`
Delete a game and all associated coaching points.

**Parameters:**
- Path: `gameId` (UUID) - Game ID to delete

**Request Body Schema:**
- None

**Response Schema:**
```json
{
  "message": "Game deleted successfully"
}
```

**Authentication/Role Requirements:**
- Bearer token required
- User must be Coach or Admin of the game's team

**Error Responses:**
- `401` - User not authenticated
- `403` - User not coach or admin of team
- `404` - Game not found
- `400` - Deletion failed

**Business Logic Notes:**
- Cascading deletion removes all coaching points for the game
- Verifies user permissions before allowing deletion
- Irreversible operation
