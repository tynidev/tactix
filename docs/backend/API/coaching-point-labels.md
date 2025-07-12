← [Back to API Overview](../../api-readme.md)

# Coaching Point Labels API

## API Overview
Manages the assignment and removal of labels to coaching points for categorization and filtering purposes. Labels help organize coaching feedback by topics or themes.

## Base URL
`/api/coaching-point-labels`

## Authentication Requirements
- All endpoints require Bearer token authentication
- Only coaches can assign and remove labels

## Endpoints Table

| Method | Endpoint | Description | Auth Required | Roles |
|--------|----------|-------------|---------------|-------|
| POST | [`/`](#post-) | Assign label to coaching point | Yes | Coach |
| DELETE | [`/:id`](#delete-id) | Remove label assignment | Yes | Coach |

## Detailed Route Documentation

### POST `/`
Assign a label to a coaching point for categorization.

**Parameters:**
- Body: Label assignment data

**Request Body Schema:**
```json
{
  "point_id": "uuid (required)",
  "label_id": "uuid (required)"
}
```

**Response Schema:**
```json
{
  "id": "uuid",
  "point_id": "uuid",
  "label_id": "uuid",
  "created_at": "timestamp"
}
```

**Authentication/Role Requirements:**
- Bearer token required
- User must be Coach of the coaching point's game team

**Error Responses:**
- `400` - Missing required fields (point_id, label_id)
- `401` - User not authenticated
- `403` - Only coaches can assign labels to coaching points
- `404` - Coaching point not found, access denied, or label not found/doesn't belong to team
- `409` - Label already assigned to this coaching point
- `500` - Failed to assign label

**Business Logic Notes:**
- Verifies user has coach role in the coaching point's game team
- Validates that the label belongs to the same team as the coaching point
- Prevents duplicate label assignments to the same coaching point
- Labels must be created via the Teams API before assignment

### DELETE `/:id`
Remove a label assignment from a coaching point.

**Parameters:**
- Path: `id` (UUID) - Label assignment ID to remove

**Request Body Schema:**
- None

**Response Schema:**
- `204 No Content` (empty response body)

**Authentication/Role Requirements:**
- Bearer token required
- User must be Coach of the coaching point's game team

**Error Responses:**
- `401` - User not authenticated
- `403` - Only coaches can remove label assignments
- `404` - Label assignment not found or access denied
- `500` - Failed to remove label assignment

**Business Logic Notes:**
- Only removes the assignment relationship, not the label itself
- Label remains available for assignment to other coaching points
- Verifies user permissions before allowing removal
- Returns 204 status on successful removal

## Business Logic Details

### Label-Team Relationship
- Labels are created at the team level via the Teams API
- Only labels belonging to the same team as the coaching point can be assigned
- This ensures consistent labeling within team contexts

### Assignment Uniqueness
- Each label can only be assigned once to a specific coaching point
- Attempting to assign the same label twice returns a 409 Conflict error
- Multiple different labels can be assigned to the same coaching point

### Permission Validation
- User must be a coach in the team that owns both the coaching point and the label
- Permission is validated through the coaching point's game relationship to the team
- Labels from other teams cannot be assigned, even if user has access to multiple teams
