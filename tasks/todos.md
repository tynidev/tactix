
# Dashboard
* [ ] Games analyzed and sessions statistics are incorrect - need to fix or replace with other meaningful stats

# Auth
* [ ] Sign out doesn't properly invalidate the session - users can navigate back to protected pages
* [ ] Need to test joining a team when signing in
* [ ] Forgot my password

# Coaching Points
* [ ] Keyboard shortcuts for adding coaching point
* [ ] Make coaching points editable after creation

# Change Tech Stack
* [ ] Change to local tech stack
- Keycloak: user auth + OAuth, JWT access
- PostgreSQL: user/account data + TACTIX App data
- Mailcow: Email SMTP server
- NGINX + HTTPS for reverse proxy and TLS
- Your app (React/Node) using OpenID Connect to talk to Keycloak

# Danny Issues
- Not intuitive to add drawing before adding static coaching point. User thinks they need to click + first then draw.
- After a while of adding coaching points Danny was kicked out to the sign-in page while watching a game. During this time I also re-deployed the website... Not sure what the cause was.
- Add Player (Confusing to pick guardian or staff first. Just have checkbox to add as guardian)
- Player join (need to be able to select an existing player to claim...)
- Guardian join (need to be able to select an existing player as their child...)
- Need to record viewing of coaching points at end of audio playback OR on still shot coaching point loaded