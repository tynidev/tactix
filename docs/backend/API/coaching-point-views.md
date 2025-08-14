# Coaching Point Views API

This API handles view tracking and analytics for coaching points.

## Endpoints

### Record a View

Records when a user views a coaching point.

**POST** `/api/coaching-points/:id/view`

**Headers:**
- `Authorization: Bearer <token>` (required)

**URL Parameters:**
- `id` - The coaching point ID

**Request Body:**
```json
{
  "completionPercentage": 50  // Optional, default 0
}
```

**Response:**
```json
{
  "eventId": "uuid",
  "viewCount": 3
}
```

**Errors:**
- `401` - Unauthorized
- `500` - Server error

---

### Update View Event

Updates the completion percentage for an existing view event (e.g., as user watches more of the video).

**PATCH** `/api/coaching-points/view-events/:eventId`

**Headers:**
- `Authorization: Bearer <token>` (required)

**URL Parameters:**
- `eventId` - The view event ID

**Request Body:**
```json
{
  "completionPercentage": 85
}
```

**Response:**
```json
{
  "id": "uuid",
  "point_id": "uuid",
  "user_id": "uuid",
  "completion_percentage": 85,
  "created_at": "2025-01-15T10:00:00Z"
}
```

**Errors:**
- `400` - Invalid completion percentage (must be 0-100)
- `401` - Unauthorized
- `404` - View event not found
- `500` - Server error

---

### Get Unviewed Coaching Points

Returns all coaching points the current user hasn't viewed yet.

**GET** `/api/coaching-points/unviewed`

**Headers:**
- `Authorization: Bearer <token>` (required)

**Response:**
```json
[
  {
    "id": "uuid",
    "game_id": "uuid",
    "author_id": "uuid",
    "title": "Corner kick defense",
    "feedback": "Need to mark players better",
    "timestamp": 45000,
    "audio_url": "https://...",
    "duration": 30000,
    "created_at": "2025-01-15T10:00:00Z",
    "game": {
      "opponent": "Thunder FC",
      "date": "2025-01-14"
    },
    "tagged_players": ["player_id_1", "player_id_2"]
  }
]
```

**Errors:**
- `401` - Unauthorized
- `500` - Server error

---

### Get Team View Analytics

Returns view analytics for all coaching points in a team. **Coaches only.**

**GET** `/api/teams/:teamId/view-analytics`

**Headers:**
- `Authorization: Bearer <token>` (required)

**URL Parameters:**
- `teamId` - The team ID

**Response:**
```json
[
  {
    "id": "uuid",
    "title": "Corner kick defense",
    "timestamp": 45000,
    "uniqueViewers": 12,
    "totalViews": 24,
    "avgCompletion": 75,
    "completedViews": 18
  }
]
```

**Response Fields:**
- `uniqueViewers` - Number of unique users who have viewed this point
- `totalViews` - Total number of view events
- `avgCompletion` - Average completion percentage (0-100)
- `completedViews` - Number of views with >80% completion

**Errors:**
- `401` - Unauthorized
- `403` - Only coaches can view analytics
- `500` - Server error

## Implementation Notes

The view tracking system uses two tables:
- `coaching_point_view_events` - Records each individual view with completion percentage
- `coaching_point_view_summary` - Maintains aggregate data per user/point combination

A database trigger automatically updates the summary table when view events are created.

## Usage Examples

### Frontend View Tracking

```javascript
// When user starts viewing a coaching point
const startView = async (coachingPointId) => {
  const response = await fetch(`/api/coaching-points/${coachingPointId}/view`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ completionPercentage: 0 })
  });
  const data = await response.json();
  return data.eventId;
};

// Update completion as video plays
const updateViewProgress = async (eventId, percentage) => {
  await fetch(`/api/coaching-points/view-events/${eventId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ completionPercentage: percentage })
  });
};
```

### Coach Analytics Dashboard

```javascript
// Get analytics for team
const getTeamAnalytics = async (teamId) => {
  const response = await fetch(`/api/teams/${teamId}/view-analytics`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return response.json();
};
