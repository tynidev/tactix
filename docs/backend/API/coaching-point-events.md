← [Back to API Overview](../../api-readme.md)

# Coaching Point Events API

## API Overview
Manages event tracking for coaching point playback sessions, including video controls, drawing actions, and session timing data for accurate replay functionality.

## Base URL
`/api/coaching-point-events`

## Authentication Requirements
- All endpoints require Bearer token authentication
- Only coaches and coaching point authors can manage events

## Endpoints Table

| Method | Endpoint | Description | Auth Required | Roles |
|--------|----------|-------------|---------------|-------|
| POST | [`/`](#post-) | Create single coaching point event | Yes | Coach, Point Author |
| POST | [`/batch`](#post-batch) | Create multiple coaching point events | Yes | Coach, Point Author |
| GET | [`/point/:pointId`](#get-pointpointid) | Get events for coaching point | Yes | Team Members |
| DELETE | [`/:id`](#delete-id) | Delete coaching point event | Yes | Coach, Point Author |

## Detailed Route Documentation

### POST `/`
Create a single coaching point event for session tracking.

**Parameters:**
- Body: Event creation data

**Request Body Schema:**
```json
{
  "point_id": "uuid (required)",
  "event_type": "play|pause|seek|draw|change_speed|recording_start (required)",
  "timestamp": "number (required, milliseconds from recording start)",
  "event_data": "object (required, event-specific data)"
}
```

**Response Schema:**
```json
{
  "id": "uuid",
  "point_id": "uuid",
  "event_type": "play|pause|seek|draw|change_speed|recording_start",
  "timestamp": "number",
  "event_data": "object",
  "created_at": "timestamp"
}
```

**Authentication/Role Requirements:**
- Bearer token required
- User must be either:
  - Author of the coaching point, OR
  - Coach in the game's team

**Error Responses:**
- `400` - Missing required fields
- `401` - User not authenticated
- `403` - Only author or coaches can add events
- `404` - Coaching point not found or access denied
- `500` - Failed to create event

**Business Logic Notes:**
- Timestamp is relative to recording session start (milliseconds)
- Event data format varies by event type
- Used for accurate playback of coaching sessions

### POST `/batch`
Create multiple coaching point events in a single request for efficiency.

**Parameters:**
- Body: Batch event creation data

**Request Body Schema:**
```json
{
  "events": [
    {
      "point_id": "uuid (required)",
      "event_type": "play|pause|seek|draw|change_speed|recording_start (required)",
      "timestamp": "number (required)",
      "event_data": "object (required)"
    }
  ]
}
```

**Response Schema:**
```json
[
  {
    "id": "uuid",
    "point_id": "uuid",
    "event_type": "string",
    "timestamp": "number",
    "event_data": "object",
    "created_at": "timestamp"
  }
]
```

**Authentication/Role Requirements:**
- Bearer token required
- User must be either:
  - Author of the coaching point, OR
  - Coach in the game's team
- All events must belong to the same coaching point

**Error Responses:**
- `400` - Missing required fields or empty events array
- `401` - User not authenticated
- `403` - Only author or coaches can add events
- `404` - Coaching point not found or access denied
- `500` - Failed to create events

**Business Logic Notes:**
- Validates permissions using the first event's point_id
- All events in batch must belong to same coaching point
- Atomic operation - either all events are created or none
- More efficient than individual event creation for bulk operations

### GET `/point/:pointId`
Get all events for a specific coaching point ordered by timestamp.

**Parameters:**
- Path: `pointId` (UUID) - Coaching point ID to get events for

**Request Body Schema:**
- None

**Response Schema:**
```json
[
  {
    "id": "uuid",
    "point_id": "uuid",
    "event_type": "play|pause|seek|draw|change_speed|recording_start",
    "timestamp": "number",
    "event_data": "object",
    "created_at": "timestamp"
  }
]
```

**Authentication/Role Requirements:**
- Bearer token required
- User must be member of the coaching point's game team

**Error Responses:**
- `401` - User not authenticated
- `404` - Coaching point not found or access denied
- `500` - Failed to fetch events

**Business Logic Notes:**
- Events ordered by timestamp (ascending) for sequential playback
- Used to recreate the exact recording session
- Includes all event types for complete session reconstruction

### DELETE `/:id`
Delete a specific coaching point event.

**Parameters:**
- Path: `id` (UUID) - Event ID to delete

**Request Body Schema:**
- None

**Response Schema:**
- `204 No Content` (empty response body)

**Authentication/Role Requirements:**
- Bearer token required
- User must be either:
  - Author of the coaching point, OR
  - Coach in the game's team

**Error Responses:**
- `401` - User not authenticated
- `403` - Only author or coaches can delete events
- `404` - Event not found or access denied
- `500` - Failed to delete event

**Business Logic Notes:**
- Removes individual event from session timeline
- May affect playback accuracy if critical events are removed
- Consider impact on session integrity before deletion

## Event Types and Data Formats

### `recording_start` Event
Captures initial session state when recording begins.

```json
{
  "event_data": {
    "playbackSpeed": 1.0,
    "videoTimestamp": 0,
    "existingDrawings": []
  }
}
```

### `play` Event
Video playback started.

```json
{
  "event_data": {
    "videoTimestamp": 1234,
    "playbackSpeed": 1.0
  }
}
```

### `pause` Event
Video playback paused.

```json
{
  "event_data": {
    "videoTimestamp": 5678
  }
}
```

### `seek` Event
Video position changed.

```json
{
  "event_data": {
    "fromTimestamp": 1000,
    "toTimestamp": 2000
  }
}
```

### `draw` Event
Drawing action performed on canvas.

```json
{
  "event_data": {
    "drawingId": "uuid",
    "drawingType": "stroke|rectangle|ellipse",
    "drawingData": {},
    "videoTimestamp": 1234
  }
}
```

### `change_speed` Event
Video playback speed changed.

```json
{
  "event_data": {
    "fromSpeed": 1.0,
    "toSpeed": 0.5,
    "videoTimestamp": 1234
  }
}
