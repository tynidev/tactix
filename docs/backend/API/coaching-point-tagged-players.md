← [Back to API Overview](../../api-readme.md)

# Coaching Point Tagged Players API

## API Overview
Manages the tagging and untagging of players to coaching points, allowing coaches to specify which players should receive specific feedback or are involved in particular coaching moments.

## Base URL
`/api/coaching-point-tagged-players`

## Authentication Requirements
- All endpoints require Bearer token authentication
- Only coaches can tag and untag players

## Endpoints Table

| Method | Endpoint | Description | Auth Required | Roles |
|--------|----------|-------------|---------------|-------|
| POST | [`/`](#post-) | Tag player to coaching point | Yes | Coach |
| DELETE | [`/:id`](#delete-id) | Remove player tag | Yes | Coach |

## Detailed Route Documentation

### POST `/`
Tag a player to a coaching point to indicate the feedback is relevant to them.

**Parameters:**
- Body: Player tagging data

**Request Body Schema:**
```json
{
  "point_id": "uuid (required)",
  "player_id": "uuid (required)"
}
```

**Response Schema:**
```json
{
  "id": "uuid",
  "point_id": "uuid",
  "player_id": "uuid",
  "created_at": "timestamp"
}
```

**Authentication/Role Requirements:**
- Bearer token required
- User must be Coach of the coaching point's game team

**Error Responses:**
- `400` - Missing required fields (point_id, player_id)
- `401` - User not authenticated
- `403` - Only coaches can tag players to coaching points
- `404` - Coaching point not found, access denied, or player not found/doesn't belong to team
- `409` - Player already tagged to this coaching point
- `500` - Failed to tag player

**Business Logic Notes:**
- Verifies user has coach role in the coaching point's game team
- Validates that the player belongs to the same team as the coaching point
- Prevents duplicate player tags to the same coaching point
- Players must be part of the team before they can be tagged

### DELETE `/:id`
Remove a player tag from a coaching point.

**Parameters:**
- Path: `id` (UUID) - Player tag ID to remove

**Request Body Schema:**
- None

**Response Schema:**
- `204 No Content` (empty response body)

**Authentication/Role Requirements:**
- Bearer token required
- User must be Coach of the coaching point's game team

**Error Responses:**
- `401` - User not authenticated
- `403` - Only coaches can remove player tags
- `404` - Player tag not found or access denied
- `500` - Failed to remove player tag

**Business Logic Notes:**
- Only removes the tagging relationship, not the player or coaching point
- Player remains available for tagging to other coaching points
- Verifies user permissions before allowing removal
- Returns 204 status on successful removal

## Business Logic Details

### Player-Team Relationship
- Players must be members of the team before they can be tagged to coaching points
- Only players belonging to the same team as the coaching point can be tagged
- This ensures coaching feedback is only assigned to relevant team members

### Tag Uniqueness
- Each player can only be tagged once to a specific coaching point
- Attempting to tag the same player twice returns a 409 Conflict error
- Multiple different players can be tagged to the same coaching point

### Permission Validation
- User must be a coach in the team that owns both the coaching point and the player
- Permission is validated through the coaching point's game relationship to the team
- Players from other teams cannot be tagged, even if user has access to multiple teams

### Use Cases
- **Individual Feedback**: Tag specific players who need particular attention
- **Group Feedback**: Tag multiple players involved in a play or situation
- **Position-specific**: Tag players by position for role-specific coaching
- **Performance Reviews**: Tag players for performance evaluation discussions
