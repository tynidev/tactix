# TACTIX Backend API Documentation

## Overview

The TACTIX backend API provides endpoints for managing sports teams, games, and coaching analysis features. Built with Node.js/Express and Supabase, the API supports role-based access control and comprehensive team management functionality.

## Base URL

```
https://your-api-domain.com/api
```

## Authentication

All API endpoints (except public validation endpoints) require authentication using a Bearer token obtained from Supabase Auth.

### Headers

```
Authorization: Bearer <supabase_jwt_token>
Content-Type: application/json
```

### User Roles

The API implements role-based access control with the following roles:

- **Coach**: Full access to team management, games, and coaching features
- **Admin**: Similar to coach with additional administrative privileges
- **Player**: Read access to relevant team and game data
- **Guardian**: Limited access to manage child player profiles

## API Modules

| Module | Description | Base Route |
|--------|-------------|------------|
| [Authentication](./backend/API/auth.md) | User signup, profile management | `/api/auth` |
| [Teams](./backend/API/teams.md) | Team management, membership, and join codes | `/api/teams` |
| [Games](./backend/API/games.md) | Game creation, management, and team association | `/api/games` |
| [Coaching Points](./backend/API/coaching-points.md) | Video analysis and coaching feedback management | `/api/coaching-points` |
| [Coaching Point Events](./backend/API/coaching-point-events.md) | Event tracking for coaching point playback | `/api/coaching-point-events` |
| [Coaching Point Labels](./backend/API/coaching-point-labels.md) | Label management for coaching points | `/api/coaching-point-labels` |
| [Coaching Point Tagged Players](./backend/API/coaching-point-tagged-players.md) | Player tagging for coaching points | `/api/coaching-point-tagged-players` |
| [Coaching Point Views](./backend/API/coaching-point-views.md) | View tracking and analytics for coaching points | `/api/coaching-points/:id/view` |

## Common Response Formats

### Success Response
```json
{
  "message": "Operation successful",
  "data": { ... }
}
```

### Error Response
```json
{
  "error": "Error description",
  "details": "Additional error details"
}
```

## HTTP Status Codes

- `200` - Success
- `201` - Created
- `204` - No Content (successful deletion)
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `500` - Internal Server Error
