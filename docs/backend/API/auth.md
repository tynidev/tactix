← [Back to API Overview](../../api-readme.md)

# Authentication API

## API Overview
Manages user authentication, profile management, and user-related operations including signup, profile updates, and player relationship management.

## Base URL
`/api/auth`

## Authentication Requirements
- Most endpoints require Bearer token authentication
- Public endpoint: `/signup`

## Endpoints Table

| Method | Endpoint | Description | Auth Required | Roles |
|--------|----------|-------------|---------------|-------|
| POST | [`/signup`](#post-signup) | Create new user account | No | Public |
| GET | [`/me`](#get-me) | Get current user profile | Yes | All |
| PUT | [`/profile`](#put-profile) | Update user profile | Yes | All |
| GET | [`/guardian-players`](#get-guardian-players) | Get players user has relationship with | Yes | Guardian, Player |
| DELETE | [`/players/:playerId`](#delete-playersplayerid) | Delete player profile | Yes | Guardian, Player |

## Detailed Route Documentation

### POST `/signup`
Create a new user account with optional team joining.

**Parameters:**
- Body: User registration data

**Request Body Schema:**
```json
{
  "email": "string (required)",
  "password": "string (required)",
  "name": "string (required)",
  "teamCode": "string (optional)"
}
```

**Response Schema:**
```json
{
  "message": "User created successfully",
  "user": {
    "id": "uuid",
    "name": "string",
    "email": "string",
    "created_at": "timestamp"
  },
  "teamJoin": {
    "success": "boolean",
    "message": "string",
    "team": {
      "id": "uuid",
      "name": "string",
      "role": "string"
    }
  }
}
```

**Authentication/Role Requirements:**
- No authentication required
- Public endpoint

**Error Responses:**
- `400` - Missing required fields or invalid team code
- `500` - Internal server error

**Business Logic Notes:**
- Creates user in Supabase Auth
- Automatically creates user profile via database trigger
- If teamCode provided, attempts to join team with service role permissions
- If team join fails, user is still created but teamJoin.success will be false

### GET `/me`
Get current authenticated user's profile information.

**Parameters:**
- None (user ID extracted from JWT token)

**Request Body Schema:**
- None

**Response Schema:**
```json
{
  "id": "uuid",
  "name": "string",
  "email": "string",
  "created_at": "timestamp"
}
```

**Authentication/Role Requirements:**
- Bearer token required
- Available to all authenticated users

**Error Responses:**
- `401` - User not authenticated
- `404` - User profile not found

### PUT `/profile`
Update the current user's profile information.

**Parameters:**
- Body: Profile update data

**Request Body Schema:**
```json
{
  "name": "string (required)"
}
```

**Response Schema:**
```json
{
  "message": "Profile updated successfully",
  "user": {
    "id": "uuid",
    "name": "string",
    "email": "string",
    "created_at": "timestamp"
  }
}
```

**Authentication/Role Requirements:**
- Bearer token required
- Available to all authenticated users

**Error Responses:**
- `400` - Invalid name or missing required field
- `401` - User not authenticated

### GET `/guardian-players`
Get all players that the authenticated user has a relationship with (either as guardian or owner).

**Parameters:**
- None (user ID extracted from JWT token)

**Request Body Schema:**
- None

**Response Schema:**
```json
[
  {
    "id": "uuid",
    "name": "string",
    "jersey_number": "string",
    "user_id": "uuid",
    "created_at": "timestamp",
    "relationship_type": "guardian|owner",
    "relationship_created": "timestamp"
  }
]
```

**Authentication/Role Requirements:**
- Bearer token required
- Available to all authenticated users

**Error Responses:**
- `401` - User not authenticated
- `400` - Database query error

**Business Logic Notes:**
- Returns players where user is listed as guardian in guardian_player_relationships
- Also returns players directly owned by user (user_id = authenticated user)
- Avoids duplicates when user is both guardian and owner

### DELETE `/players/:playerId`
Delete a player profile. Only accessible by guardians or the player owner.

**Parameters:**
- Path: `playerId` (UUID) - ID of player profile to delete

**Request Body Schema:**
- None

**Response Schema:**
```json
{
  "message": "Player {name} (#{jersey}) deleted successfully"
}
```

**Authentication/Role Requirements:**
- Bearer token required
- User must be either:
  - Guardian with relationship to the player
  - Owner of the player profile (user_id matches)

**Error Responses:**
- `401` - User not authenticated
- `403` - Insufficient permissions
- `404` - Player not found

**Business Logic Notes:**
- Performs cascading deletion in correct order:
  1. coaching_point_acknowledgments
  2. coaching_point_tagged_players
  3. team_players
  4. guardian_player_relationships
  5. player_profiles
- Preserves data integrity during deletion process
