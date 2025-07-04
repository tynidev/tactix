# DB Schema

## users
| Column       | Type      | Description                |
| ------------ | --------- | -------------------------- |
| `id`         | UUID (PK) | Unique user ID             |
| `name`       | Text      | Full name                  |
| `email`      | Text      | Unique login email         |
| `created_at` | Timestamp | Account creation timestamp |

## teams
| Column       | Type      | Description             |
| ------------ | --------- | ----------------------- |
| `id`         | UUID (PK) | Unique team ID          |
| `name`       | Text      | Team name               |
| `created_at` | Timestamp | Team creation timestamp |

## team_memberships
| Column      | Type      | Description                         |
| ----------- | --------- | ------------------------------------|
| `id`        | UUID (PK) | Unique membership ID                |
| `team_id`   | UUID (FK) | References `teams.id`               |
| `user_id`   | UUID (FK) | References `users.id`               |
| `role`      | Enum      | (`coach`,`player`,`admin`,`parent`) |

## parent_child_relationships
| Column      | Type      | Description                         |
| ----------- | --------- | ------------------------------------|
| `id`        | UUID (PK) | Unique relationship ID              |
| `parent_id` | UUID (FK) | References `users.id` (parent)      |
| `child_id`  | UUID (FK) | References `users.id` (child)       |
| `created_at`| Timestamp | When relationship was created       |

## games
| Column       | Type         | Description                            |
| ------------ | ------------ | ---------------------------------------|
| `id`         | UUID (PK)    | Unique game ID                         |
| `team_id`    | UUID (FK)    | References `teams.id`                  |
| `opponent`   | Text         | Opposing team name                     |
| `date`       | Date         | Date of the game                       |
| `location`   | Text         | Where the game was played              |
| `video_id`   | VARCHAR(11)  | YouTube Video ID                       |
| `team_score` | Integer (≥0) | Our team's score                       |
| `opp_score`  | Integer (≥0) | Opponent's score                       |
| `game_type`  | Enum         | (`regular`, `tournament`, `scrimmage`) |
| `home_away`  | Enum         | (`home`, `away`, `neutral`)            |
| `notes`      | Text         | General game notes                     |

## coaching_points
| Column        | Type      | Description                           |
| ------------- | --------- | ------------------------------------- |
| `id`          | UUID (PK) | Unique point ID                       |
| `game_id`     | UUID (FK) | References `games.id`                 |
| `author_id`   | UUID (FK) | References `users.id` (coach)         |
| `title`       | Text      | Short summary                         |
| `feedback`    | Text      | Detailed feedback                     |
| `timestamp`   | Time      | Time in video (e.g., 12:34)           |
| `audio_url`   | Text      | URL to stored audio file              |
| `duration`    | Integer   | Total duration in milliseconds        |
| `created_at`  | Timestamp | When it was added                     |

## coaching_point_events
| Column        | Type      | Description                                       |
| ------------- | --------- | ------------------------------------------------- |
| `id`          | UUID (PK) | Unique event ID                                   |
| `point_id`    | UUID (FK) | References `coaching_points.id`                   |
| `event_type`  | Enum      | (`play`, `pause`, `seek`, `draw`, `change_speed`) |
| `timestamp`   | Integer   | Milliseconds from recording start                 |
| `event_data`  | JSONB     | Event-specific data                               |
| `created_at`  | Timestamp | When event was recorded                           |

## coaching_point_tagged_users
| Column        | Type      | Description                           |
| ------------- | --------- | ------------------------------------- |
| `id`          | UUID (PK) | Unique tag ID                         |
| `point_id`    | UUID (FK) | References `coaching_points.id`       |
| `user_id`     | UUID (FK) | References `users.id`                 |
| `created_at`  | Timestamp | When tag was created                  |

## labels
| Column        | Type      | Description                           |
| ------------- | --------- | ------------------------------------- |
| `id`          | UUID (PK) | Unique label ID                       |
| `team_id`     | UUID (FK) | References `teams.id`                 |
| `name`        | Text      | Label text (e.g., "corner kick")      |
| `created_at`  | Timestamp | When label was created                |

## coaching_point_labels
| Column        | Type      | Description                           |
| ------------- | --------- | ------------------------------------- |
| `id`          | UUID (PK) | Unique association ID                 |
| `point_id`    | UUID (FK) | References `coaching_points.id`       |
| `label_id`    | UUID (FK) | References `labels.id`                |
| `created_at`  | Timestamp | When label was applied                |

# Diagram

```mermaid
erDiagram
    users {
        UUID id PK
        Text name
        Text email
        Timestamp created_at
    }
    
    teams {
        UUID id PK
        Text name
        Timestamp created_at
    }
    
    team_memberships {
        UUID id PK
        UUID team_id FK
        UUID user_id FK
        Enum role
    }
    
    parent_child_relationships {
        UUID id PK
        UUID parent_id FK
        UUID child_id FK
        Timestamp created_at
    }
    
    games {
        UUID id PK
        UUID team_id FK
        Text opponent
        Date date
        Text location
        VARCHAR video_id
        Integer team_score
        Integer opp_score
        Enum game_type
        Enum home_away
        Text notes
    }
    
    coaching_points {
        UUID id PK
        UUID game_id FK
        UUID author_id FK
        Text title
        Text feedback
        Time timestamp
        Integer duration
        Timestamp created_at
    }
    
    coaching_point_events {
        UUID id PK
        UUID point_id FK
        Enum event_type
        Integer timestamp
        JSONB event_data
        Timestamp created_at
    }
    
    coaching_point_tagged_users {
        UUID id PK
        UUID point_id FK
        UUID user_id FK
        Timestamp created_at
    }
    
    labels {
        UUID id PK
        UUID team_id FK
        Text name
        Timestamp created_at
    }
    
    coaching_point_labels {
        UUID id PK
        UUID point_id FK
        UUID label_id FK
        Timestamp created_at
    }
    
    users ||--o{ team_memberships : "has many"
    teams ||--o{ team_memberships : "has many"
    users ||--o{ parent_child_relationships : "parent"
    users ||--o{ parent_child_relationships : "child"
    teams ||--o{ games : "has many"
    games ||--o{ coaching_points : "has many"
    users ||--o{ coaching_points : "authors"
    coaching_points ||--o{ coaching_point_events : "has many"
    coaching_points ||--o{ coaching_point_tagged_users : "has many"
    users ||--o{ coaching_point_tagged_users : "tagged in"
    teams ||--o{ labels : "has many"
    coaching_points ||--o{ coaching_point_labels : "has many"
    labels ||--o{ coaching_point_labels : "applied to"
```