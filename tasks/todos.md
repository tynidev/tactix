
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