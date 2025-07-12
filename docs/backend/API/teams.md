← [Back to API Overview](../../api-readme.md)

# Teams API

## API Overview
Manages team creation, membership, join codes, player profiles, and team-related operations including role-based access control and team member management.

## Base URL
`/api/teams`

## Authentication Requirements
- All endpoints require Bearer token authentication except join code validation
- Role-based access control varies by endpoint

## Endpoints Table

| Method | Endpoint | Description | Auth Required | Roles |
|--------|----------|-------------|---------------|-------|
| GET | [`/join-codes/:code/validate`](#get-join-codescodevalidate) | Validate join code (public) | No | Public |
| POST | [`/`](#post-) | Create new team | Yes | All |
| GET | [`/`](#get-) | Get user's teams | Yes | All |
| PUT | [`/:teamId`](#put-teamid) | Update team | Yes | Coach, Admin |
| POST | [`/join`](#post-join) | Join team using code | Yes | All |
| GET | [`/:teamId/join-codes`](#get-teamidjoin-codes) | Get team join codes | Yes | Coach, Admin, Player, Guardian |
| POST | [`/:teamId/join-codes`](#post-teamidjoin-codes) | Create join code | Yes | Coach, Admin, Guardian |
| GET | [`/:teamId/labels`](#get-teamidlabels) | Get team labels | Yes | Coach, Admin, Player, Guardian |
| POST | [`/:teamId/labels`](#post-teamidlabels) | Create team label | Yes | Coach, Admin |
| GET | [`/:teamId`](#get-teamid) | Get team details | Yes | Coach, Admin, Player, Guardian |
| GET | [`/:teamId/members`](#get-teamidmembers) | Get team members | Yes | Coach, Admin, Player, Guardian |
| GET | [`/:teamId/players`](#get-teamidplayers) | Get team players | Yes | Coach, Admin, Player, Guardian |
| POST | [`/:teamId/player-profiles`](#post-teamidplayer-profiles) | Create player profile | Yes | Coach, Admin, Guardian |
| PUT | [`/:teamId/members/:membershipId/remove`](#put-teamidmembersmembershipidremove) | Remove team member | Yes | Variable |
| PUT | [`/:teamId/players/:playerId/remove`](#put-teamidplayersplayeridremove) | Remove team player | Yes | Variable |
| DELETE | [`/:teamId`](#delete-teamid) | Delete team | Yes | Coach, Admin |

## Detailed Route Documentation

### GET `/join-codes/:code/validate`
Validate a join code and return team information (public endpoint).

**Parameters:**
- Path: `code` (string) - Join code to validate

**Request Body Schema:**
- None

**Response Schema:**
```json
{
  "team_name": "string",
  "team_role": "coach|admin|player|guardian",
  "team_id": "uuid"
}
```

**Authentication/Role Requirements:**
- No authentication required
- Public endpoint for join code validation

**Error Responses:**
- `400` - Join code required or expired
- `404` - Invalid or inactive join code

**Business Logic Notes:**
- Checks if join code exists and is active
- Validates expiration date if set
- Returns team information without requiring authentication

### POST `/`
Create a new team with the authenticated user as coach.

**Parameters:**
- Body: Team creation data

**Request Body Schema:**
```json
{
  "name": "string (required)"
}
```

**Response Schema:**
```json
{
  "message": "Team created successfully",
  "team": {
    "id": "uuid",
    "name": "string",
    "created_at": "timestamp",
    "join_codes": {
      "player": "string",
      "coach": "string", 
      "admin": "string",
      "guardian": "string"
    }
  }
}
```

**Authentication/Role Requirements:**
- Bearer token required
- Available to all authenticated users

**Error Responses:**
- `400` - Team name required or creation failed
- `401` - User not authenticated

**Business Logic Notes:**
- Creates team with authenticated user as coach
- Automatically generates permanent join codes for all roles
- Uses safe character set (ABCDEFGHJKMNPQRSTUVWXYZ23456789) for codes
- Maximum 100 attempts to generate unique codes

### GET `/`
Get all teams the authenticated user is a member of with enhanced metadata.

**Parameters:**
- None (user ID extracted from JWT token)

**Request Body Schema:**
- None

**Response Schema:**
```json
[
  {
    "role": "coach|admin|player|guardian",
    "teams": {
      "id": "uuid",
      "name": "string",
      "created_at": "timestamp",
      "player_count": "number",
      "game_count": "number", 
      "reviewed_games_count": "number",
      "coaches": [
        {
          "name": "string"
        }
      ]
    }
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
- Returns user's role in each team
- Includes player count, game count, and reviewed games count
- Reviewed games are those with at least one coaching point
- Includes list of coaches for each team

### PUT `/:teamId`
Update team information (name).

**Parameters:**
- Path: `teamId` (UUID) - Team ID to update
- Body: Team update data

**Request Body Schema:**
```json
{
  "name": "string (required)"
}
```

**Response Schema:**
```json
{
  "message": "Team updated successfully",
  "team": {
    "id": "uuid",
    "name": "string",
    "created_at": "timestamp"
  }
}
```

**Authentication/Role Requirements:**
- Bearer token required
- User must be Coach or Admin of the team

**Error Responses:**
- `400` - Invalid team data
- `403` - Insufficient permissions
- `404` - Team not found

### POST `/join`
Join a team using a join code with optional role selection and player profile creation.

**Parameters:**
- Body: Join request data

**Request Body Schema:**
```json
{
  "joinCode": "string (required)",
  "selectedRole": "coach|admin|player|guardian (optional)",
  "playerName": "string (optional, for player role)",
  "jerseyNumber": "string (optional, for player role)"
}
```

**Response Schema:**
```json
{
  "message": "Successfully joined team {name} as {role}",
  "team": {
    "id": "uuid",
    "name": "string",
    "role": "string"
  }
}
```

**Authentication/Role Requirements:**
- Bearer token required
- Available to all authenticated users

**Error Responses:**
- `400` - Invalid join code or role selection
- `404` - Join code not found
- `409` - User already member of team

**Business Logic Notes:**
- Supports fixed-role join codes or user role selection
- For player role, creates player profile and links to team
- Performs rollback on failure to maintain data consistency
- Uses user's name from profile for player name if not provided

### GET `/:teamId/join-codes`
Get active join codes for a team with role-based filtering.

**Parameters:**
- Path: `teamId` (UUID) - Team ID

**Request Body Schema:**
- None

**Response Schema:**
```json
[
  {
    "id": "uuid",
    "code": "string",
    "team_role": "coach|admin|player|guardian",
    "created_at": "timestamp",
    "expires_at": "timestamp",
    "is_active": "boolean",
    "created_by": "uuid",
    "user_profiles": {
      "name": "string"
    }
  }
]
```

**Authentication/Role Requirements:**
- Bearer token required
- User must be member of the team

**Error Responses:**
- `403` - User not team member
- `400` - Database query error

**Business Logic Notes:**
- Filters join codes based on user's role
- Everyone sees player and guardian codes
- Only coaches and admins see coach and admin codes

### POST `/:teamId/join-codes`
Create additional join code for a team with role and expiration options.

**Parameters:**
- Path: `teamId` (UUID) - Team ID
- Body: Join code creation data

**Request Body Schema:**
```json
{
  "team_role": "coach|admin|player|guardian (optional)",
  "expires_at": "timestamp (optional)",
  "guardian": "boolean (optional)"
}
```

**Response Schema:**
```json
{
  "message": "Join code created successfully",
  "join_code": {
    "id": "uuid",
    "team_id": "uuid",
    "code": "string",
    "team_role": "string",
    "expires_at": "timestamp",
    "is_active": "boolean",
    "created_by": "uuid",
    "created_at": "timestamp"
  }
}
```

**Authentication/Role Requirements:**
- Bearer token required
- User must be Coach, Admin, or Guardian of the team
- Guardians have restricted permissions (can only create player/guardian codes)

**Error Responses:**
- `400` - Invalid role or guardian restrictions
- `403` - Insufficient permissions

**Business Logic Notes:**
- Guardians can only create join codes for player or guardian roles
- Generates unique 4-character codes using safe character set
- Supports optional expiration dates

### GET `/:teamId/labels`
Get all labels created for a team.

**Parameters:**
- Path: `teamId` (UUID) - Team ID

**Request Body Schema:**
- None

**Response Schema:**
```json
[
  {
    "id": "uuid",
    "team_id": "uuid",
    "name": "string",
    "created_at": "timestamp"
  }
]
```

**Authentication/Role Requirements:**
- Bearer token required
- User must be member of the team

**Error Responses:**
- `403` - User not team member
- `400` - Database query error

### POST `/:teamId/labels`
Create a new label for the team.

**Parameters:**
- Path: `teamId` (UUID) - Team ID
- Body: Label creation data

**Request Body Schema:**
```json
{
  "name": "string (required)"
}
```

**Response Schema:**
```json
{
  "id": "uuid",
  "team_id": "uuid", 
  "name": "string",
  "created_at": "timestamp"
}
```

**Authentication/Role Requirements:**
- Bearer token required
- User must be Coach or Admin of the team

**Error Responses:**
- `400` - Label name required
- `403` - Insufficient permissions
- `409` - Label name already exists for team

### GET `/:teamId`
Get detailed team information including member counts and join codes.

**Parameters:**
- Path: `teamId` (UUID) - Team ID

**Request Body Schema:**
- None

**Response Schema:**
```json
{
  "id": "uuid",
  "name": "string",
  "created_at": "timestamp",
  "user_role": "coach|admin|player|guardian",
  "member_counts": {
    "coach": "number",
    "admin": "number", 
    "player": "number",
    "guardian": "number",
    "players": "number"
  },
  "total_games": "number",
  "join_codes": [
    {
      "id": "uuid",
      "code": "string",
      "team_role": "string",
      "created_at": "timestamp",
      "expires_at": "timestamp",
      "is_active": "boolean"
    }
  ]
}
```

**Authentication/Role Requirements:**
- Bearer token required
- User must be member of the team

**Error Responses:**
- `403` - User not team member
- `400` - Database query error

**Business Logic Notes:**
- Returns user's role in the team
- Includes member counts by role
- Join codes filtered based on user's role
- Includes total game count for the team

### GET `/:teamId/members`
Get team members grouped by role with permission indicators.

**Parameters:**
- Path: `teamId` (UUID) - Team ID

**Request Body Schema:**
- None

**Response Schema:**
```json
{
  "players": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "name": "string", 
      "email": "string",
      "jersey_number": "string",
      "joined_at": "timestamp",
      "can_remove": "boolean"
    }
  ],
  "coaches": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "name": "string",
      "email": "string",
      "role": "coach",
      "joined_at": "timestamp",
      "can_remove": "boolean"
    }
  ],
  "admins": [...],
  "guardians": [...]
}
```

**Authentication/Role Requirements:**
- Bearer token required
- User must be member of the team

**Error Responses:**
- `403` - User not team member
- `400` - Database query error

**Business Logic Notes:**
- Groups members by role (players, coaches, admins, guardians)
- Includes permission indicators for removal actions
- Users can always remove themselves
- Coaches/admins can remove guardians
- Guardians can remove players they have relationships with

### GET `/:teamId/players`
Get all players for a team with join date information.

**Parameters:**
- Path: `teamId` (UUID) - Team ID

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
    "team_joined_at": "timestamp"
  }
]
```

**Authentication/Role Requirements:**
- Bearer token required
- User must be member of the team

**Error Responses:**
- `403` - User not team member
- `400` - Database query error

### POST `/:teamId/player-profiles`
Create a new player profile for the team.

**Parameters:**
- Path: `teamId` (UUID) - Team ID
- Body: Player profile data

**Request Body Schema:**
```json
{
  "name": "string (required)",
  "jerseyNumber": "string (optional)",
  "userRole": "guardian|coach|admin|staff (required)"
}
```

**Response Schema:**
```json
{
  "message": "Player profile created with guardian relationship",
  "player": {
    "id": "uuid",
    "name": "string",
    "jersey_number": "string",
    "team_id": "uuid",
    "has_guardian_relationship": "boolean"
  }
}
```

**Authentication/Role Requirements:**
- Bearer token required
- User must be Coach, Admin, or Guardian of the team

**Error Responses:**
- `400` - Missing required fields or jersey number taken
- `403` - Insufficient permissions
- `409` - Jersey number already taken

**Business Logic Notes:**
- Checks jersey number uniqueness within team
- Creates guardian relationship if userRole is 'guardian'
- Performs rollback on failure to maintain data consistency
- Player profiles created without associated user accounts initially

### PUT `/:teamId/members/:membershipId/remove`
Remove a member from the team with role-based permissions.

**Parameters:**
- Path: `teamId` (UUID) - Team ID
- Path: `membershipId` (UUID) - Membership ID to remove

**Request Body Schema:**
- None

**Response Schema:**
```json
{
  "message": "Member has been removed from the team"
}
```

**Authentication/Role Requirements:**
- Bearer token required
- Permission rules:
  - Anyone can remove themselves
  - Coaches/admins can remove guardians
  - Coaches can remove admins

**Error Responses:**
- `403` - Insufficient permissions
- `404` - Member not found
- `401` - User not authenticated

**Business Logic Notes:**
- Self-removal always allowed
- Role hierarchy: Coach > Admin > Guardian/Player
- Only removes team membership, preserves user account

### PUT `/:teamId/players/:playerId/remove`
Remove a player from the team with cascading cleanup.

**Parameters:**
- Path: `teamId` (UUID) - Team ID
- Path: `playerId` (UUID) - Player ID to remove

**Request Body Schema:**
- None

**Response Schema:**
```json
{
  "message": "Player {name} (#{jersey}) has been removed from the team"
}
```

**Authentication/Role Requirements:**
- Bearer token required
- Permission rules:
  - Coaches/admins can remove any player
  - Guardians can remove players they have relationships with
  - Players can remove themselves

**Error Responses:**
- `403` - Insufficient permissions
- `404` - Player not found
- `401` - User not authenticated

**Business Logic Notes:**
- Performs cascading deletion of related data:
  1. coaching_point_views
  2. coaching_point_tagged_players
  3. team_players relationship
- Preserves player profile and guardian relationships
- Only removes association with the specific team

### DELETE `/:teamId`
Delete a team and all associated data.

**Parameters:**
- Path: `teamId` (UUID) - Team ID to delete

**Request Body Schema:**
- None

**Response Schema:**
```json
{
  "message": "Team deleted successfully"
}
```

**Authentication/Role Requirements:**
- Bearer token required
- User must be Coach or Admin of the team

**Error Responses:**
- `403` - Insufficient permissions
- `400` - Deletion failed
- `404` - Team not found

**Business Logic Notes:**
- Cascading deletion handled by database constraints
- Deletes all team-related data including games, coaching points, etc.
- Irreversible operation
