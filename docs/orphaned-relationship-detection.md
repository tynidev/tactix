# Orphaned Relationship Detection

## Overview
Comprehensive system to detect and clean up orphaned relationships across all database tables. This ensures referential integrity by finding records that reference non-existent foreign keys.

## What Gets Checked

The system checks all foreign key relationships in the schema:

### Core User & Team Relationships
- `player_profiles.user_id` → `user_profiles.id`
- `player_profiles.created_by` → `user_profiles.id`
- `teams.created_by` → `user_profiles.id`
- `team_join_codes.created_by` → `user_profiles.id`
- `team_players.team_id` → `teams.id`
- `team_players.player_id` → `player_profiles.id`
- `team_memberships.team_id` → `teams.id`
- `team_memberships.user_id` → `user_profiles.id`

### Guardian Relationships
- `guardian_player_relationships.guardian_id` → `user_profiles.id`
- `guardian_player_relationships.player_user_id` → `user_profiles.id` (nullable)
- `guardian_player_relationships.player_profile_id` → `player_profiles.id`

### Game & Coaching Data
- `games.team_id` → `teams.id`
- `coaching_points.game_id` → `games.id`
- `coaching_points.author_id` → `user_profiles.id`
- `coaching_point_events.point_id` → `coaching_points.id`
- `coaching_point_tagged_players.point_id` → `coaching_points.id`
- `coaching_point_tagged_players.player_id` → `player_profiles.id`
- `labels.team_id` → `teams.id`
- `coaching_point_labels.point_id` → `coaching_points.id`
- `coaching_point_labels.label_id` → `labels.id`
- `coaching_point_acknowledgments.point_id` → `coaching_points.id`
- `coaching_point_acknowledgments.player_id` → `player_profiles.id`

## Usage

### Scan Only (Recommended First)
Check for orphaned relationships without making changes:
```sql
SELECT detect_orphaned_relationships();
```

### Scan and Auto-Fix
Detect and automatically clean up orphaned relationships:
```sql
SELECT detect_orphaned_relationships(true);
```

## Sample Output

### Clean Database
```json
{
  "scan_completed_at": "2025-08-09T15:30:00Z",
  "cleanup_mode": false,
  "total_orphaned_records": 0,
  "orphaned_relationships": [],
  "cleanup_results": null,
  "summary": "No orphaned relationships found - database integrity is good!"
}
```

### Orphaned Relationships Found
```json
{
  "scan_completed_at": "2025-08-09T15:30:00Z",
  "cleanup_mode": false,
  "total_orphaned_records": 3,
  "orphaned_relationships": [
    {
      "table": "team_players",
      "foreign_key": "player_id",
      "references": "player_profiles.id",
      "count": 2,
      "orphaned_ids": ["uuid1", "uuid2"],
      "cleanup_action": "DELETE record"
    },
    {
      "table": "player_profiles",
      "foreign_key": "user_id",
      "references": "user_profiles.id",
      "count": 1,
      "orphaned_ids": ["uuid3"],
      "cleanup_action": "SET user_id to NULL or DELETE record"
    }
  ],
  "cleanup_results": null,
  "summary": "Found 3 orphaned relationships - run with cleanup_mode=true to fix them"
}
```

### After Cleanup
```json
{
  "scan_completed_at": "2025-08-09T15:35:00Z",
  "cleanup_mode": true,
  "total_orphaned_records": 3,
  "orphaned_relationships": [...],
  "cleanup_results": [
    {
      "table": "team_players",
      "action": "DELETE (invalid player_id)",
      "records_affected": 2
    },
    {
      "table": "player_profiles",
      "action": "SET user_id to NULL",
      "records_affected": 1
    }
  ],
  "summary": "Found and cleaned up 3 orphaned relationships"
}
```

## Cleanup Actions

Different types of orphaned relationships are handled differently:

### DELETE Actions
- Records that reference non-existent required foreign keys are deleted
- Examples: `team_players` with invalid `team_id` or `player_id`

### SET NULL Actions
- Nullable foreign keys pointing to non-existent records are set to NULL
- Examples: `player_profiles.user_id`, `guardian_player_relationships.player_user_id`

## Best Practices

1. **Always scan first** before running cleanup mode
2. **Review the orphaned_ids** to understand what will be affected
3. **Run during maintenance windows** as cleanup operations can be resource-intensive
4. **Take a backup** before running cleanup on production data
5. **Monitor logs** for any issues during cleanup

## Automation

You can set up periodic checks with a cron job or scheduled function:

```sql
-- Weekly integrity check (scan only)
SELECT detect_orphaned_relationships();

-- Monthly cleanup (if needed)
SELECT detect_orphaned_relationships(true);
```

## Error Handling

The function includes comprehensive error handling:
- Returns error details in JSON if any issues occur
- Individual cleanup failures don't stop the entire process
- All operations are within a transaction for safety

## Database Migration

Applied in migration: `20250809000002_add_orphaned_relationship_detection.sql`

## Security

- Function is marked `SECURITY DEFINER` for proper permissions
- Granted to `authenticated` role only
- All operations respect existing RLS policies
