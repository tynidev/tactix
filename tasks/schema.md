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
| Column       | Type        | Description                                       |
| ------------ | ----------- | ------------------------------------------------- |
| `id`         | UUID (PK)   | Unique game ID                                    |
| `team_id`    | UUID (FK)   | References `teams.id`                             |
| `opponent`   | Text        | Opposing team name                                |
| `date`       | Date        | Date of the game                                  |
| `location`   | Text        | Where the game was played                         |
| `video_id`   | VARCHAR(11) | YouTube Video ID                                  |
| `team_score` | Integer     | Our team's score                                  |
| `opp_score`  | Integer     | Opponent's score                                  |
| `game_type`  | Enum        | (`regular`, `playoff`, `tournament`, `scrimmage`) |
| `home_away`  | Enum        | (`home`, `away`, `neutral`)                       |
| `notes`      | Text        | General game notes                                |

## coaching_points
| Column        | Type      | Description                           |
| ------------- | --------- | ------------------------------------- |
| `id`          | UUID (PK) | Unique point ID                       |
| `game_id`     | UUID (FK) | References `games.id`                 |
| `author_id`   | UUID (FK) | References `users.id` (coach)         |
| `title`       | Text      | Short summary                         |
| `feedback`    | Text      | Detailed feedback                     |
| `timestamp`   | Time      | Time in video (e.g., 12:34)           |
| `created_at`  | Timestamp | When it was added                     |

## coaching_point_tags
| Column        | Type      | Description                           |
| ------------- | --------- | ------------------------------------- |
| `id`          | UUID (PK) | Unique tag ID                         |
| `point_id`    | UUID (FK) | References `coaching_points.id`       |
| `team_id`     | UUID (FK) | References `teams.id` (nullable)      |
| `user_id`     | UUID (FK) | References `users.id` (nullable)      |
| `created_at`  | Timestamp | When tag was created                  |