# Dashboard
* [ ] Games analyzed and sessions statistics are incorrect - need to fix or replace with other meaningful stats

# Auth
* [ ] Forgot my password
* [ ] When you go to a url like https://tactix-frontend-orpin.vercel.app/review/0d166d07-1c3d-4d5e-970b-e8e589b9bc7e?videoId=rIpzxuHv8ao and aren't logged in. After logging in it loses where you were going to and just redirects you to /games.

# Coaching Points
* [ ] Delete of coaching point not working when Josh tried it on laptop with touchpad mouse (when delete was clicked it just didn't do anything or sometimes would load the coaching point)
* [ ] Keyboard shortcuts for adding coaching point
* [ ] Make coaching points editable after creation
* [ ] Record that a coaching point was viewed (after audio is 75% played OR if no audio after it is rendered)
    * [ ] Coaching point list filter should have option to show only unviewed coaching points
    * [ ] Unviewed coaching points should show somewhere in UI... probably bring back dashboard

# Change Tech Stack
* [ ] Change to local tech stack

# Danny Issues
* [ ] Not intuitive to add drawing before adding static coaching point. User thinks they need to click + first then draw.
* [ ] After a while of adding coaching points Danny was kicked out to the sign-in page while watching a game. During this time I also re-deployed the website... Not sure what the cause was.
    * [ ] Noticed myself get logged out automatically
    * [ ] Captured logs - noticed session expired then refreshed later... perhaps we are expiring early
    
# Database
* [ ] Analyze cascading deletions and database cleanups
