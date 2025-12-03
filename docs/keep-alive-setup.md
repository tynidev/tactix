# TACTIX Keep-Alive Setup Guide

This guide explains how to keep your TACTIX backend (Render) and Supabase database active on free tiers.

## Problem

- **Render Free Tier**: Spins down after 15 minutes of inactivity, causing cold starts (30-60 seconds)
- **Supabase Free Tier**: Pauses projects after 7 days of inactivity

## Solution

The `keep-alive.js` script periodically pings your backend's `/health` endpoint, which can also query the database to keep both services active.

## Quick Start

### On Your Local Machine (Testing)

```bash
# Run with default settings (5-minute intervals)
node keep-alive.js --verbose

# Run once to test
node keep-alive.js --once --verbose

# Custom interval (3 minutes)
node keep-alive.js --interval 180 --verbose
```

### On Ubuntu Server

Choose one of the following methods:

---

## Method 1: systemd Service (Recommended)

This runs the script as a background service that starts automatically on boot.

### Step 1: Copy the script to your server

```bash
# Copy keep-alive.js to your server
scp keep-alive.js user@your-server:/home/user/tactix-keep-alive.js

# Make it executable
chmod +x /home/user/tactix-keep-alive.js
```

### Step 2: Create a systemd service

Create `/etc/systemd/system/tactix-keep-alive.service`:

```bash
sudo nano /etc/systemd/system/tactix-keep-alive.service
```

Add the following content:

```ini
[Unit]
Description=TACTIX Keep-Alive Service
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu
ExecStart=/usr/bin/node /home/ubuntu/tactix-keep-alive.js --backend-url https://tactix-hls7.onrender.com --interval 300 --check-db
Restart=always
RestartSec=10
StandardOutput=append:/var/log/tactix-keep-alive.log
StandardError=append:/var/log/tactix-keep-alive.log

[Install]
WantedBy=multi-user.target
```

**Note**: Adjust the `User`, `WorkingDirectory`, and paths as needed for your setup.

### Step 3: Enable and start the service

```bash
# Create log file
sudo touch /var/log/tactix-keep-alive.log
sudo chown ubuntu:ubuntu /var/log/tactix-keep-alive.log

# Reload systemd
sudo systemctl daemon-reload

# Enable service to start on boot
sudo systemctl enable tactix-keep-alive

# Start the service
sudo systemctl start tactix-keep-alive

# Check status
sudo systemctl status tactix-keep-alive
```

### Step 4: Monitor the service

```bash
# View logs in real-time
sudo journalctl -u tactix-keep-alive -f

# View recent logs
sudo tail -f /var/log/tactix-keep-alive.log

# Stop the service
sudo systemctl stop tactix-keep-alive

# Restart the service
sudo systemctl restart tactix-keep-alive
```

---

## Method 2: Cron Job (Alternative)

This runs the script once at regular intervals using cron.

### Step 1: Copy the script

```bash
scp keep-alive.js user@your-server:/home/user/tactix-keep-alive.js
chmod +x /home/user/tactix-keep-alive.js
```

### Step 2: Add to crontab

```bash
crontab -e
```

Add one of these lines:

```bash
# Every 5 minutes
*/5 * * * * /usr/bin/node /home/ubuntu/tactix-keep-alive.js --once >> /var/log/tactix-keep-alive.log 2>&1

# Every 3 minutes (more aggressive)
*/3 * * * * /usr/bin/node /home/ubuntu/tactix-keep-alive.js --once >> /var/log/tactix-keep-alive.log 2>&1

# Every 10 minutes (less frequent)
*/10 * * * * /usr/bin/node /home/ubuntu/tactix-keep-alive.js --once >> /var/log/tactix-keep-alive.log 2>&1
```

### Step 3: View logs

```bash
tail -f /var/log/tactix-keep-alive.log
```

---

## Method 3: screen/tmux (Quick & Dirty)

For testing or temporary setups.

```bash
# Using screen
screen -S tactix-keep-alive
node keep-alive.js --verbose
# Press Ctrl+A then D to detach

# Reattach later
screen -r tactix-keep-alive

# Or using tmux
tmux new -s tactix-keep-alive
node keep-alive.js --verbose
# Press Ctrl+B then D to detach

# Reattach later
tmux attach -t tactix-keep-alive
```

---

## Configuration Options

```bash
node keep-alive.js [options]

Options:
  --backend-url <url>    Backend URL (default: https://tactix-hls7.onrender.com)
  --interval <seconds>   Interval between requests (default: 300, min: 60)
  --check-db            Also query database (default: true)
  --verbose             Enable verbose logging
  --once                Run once and exit (for cron jobs)
  --help, -h            Show help message
```

### Examples

```bash
# Ping every 3 minutes with verbose output
node keep-alive.js --interval 180 --verbose

# Ping backend only (skip database check)
node keep-alive.js --check-db false

# Use custom backend URL
node keep-alive.js --backend-url https://my-custom-backend.com

# Run once for testing
node keep-alive.js --once
```

---

## Recommended Settings

### For Render Free Tier
- **Interval**: 5-10 minutes (300-600 seconds)
- Render spins down after 15 minutes, so anything under that keeps it active

### For Supabase Free Tier
- **Interval**: Any regular activity keeps it from pausing
- Set `--check-db true` (default) to query the database

### Balanced Approach
```bash
# Every 5 minutes, check both backend and database
node keep-alive.js --interval 300 --check-db true
```

---

## Monitoring & Troubleshooting

### Check if the service is running

```bash
# For systemd
sudo systemctl status tactix-keep-alive

# For cron (check if process exists)
ps aux | grep keep-alive

# For screen/tmux
screen -ls  # or tmux ls
```

### View logs

```bash
# systemd
sudo journalctl -u tactix-keep-alive -f

# cron or manual log file
tail -f /var/log/tactix-keep-alive.log
```

### Common Issues

1. **Script not found**: Ensure Node.js is installed (`node --version`)
2. **Permission denied**: Make script executable (`chmod +x keep-alive.js`)
3. **Network errors**: Check firewall and network connectivity
4. **Service won't start**: Check logs with `sudo journalctl -u tactix-keep-alive -n 50`

---

## Health Check Endpoint

The backend provides a `/health` endpoint with optional database checking:

### Basic Health Check
```bash
GET /health
```

Response:
```json
{
  "status": "OK",
  "timestamp": "2025-12-02T10:30:00.000Z",
  "uptime": 123.456
}
```

### Health Check with Database Query
```bash
GET /health?db=true
```

Response:
```json
{
  "status": "OK",
  "timestamp": "2025-12-02T10:30:00.000Z",
  "uptime": 123.456,
  "database": {
    "status": "connected",
    "recordCount": 42
  }
}
```

---

## Testing

### Manual Testing

```bash
# Test the backend health endpoint
curl https://tactix-hls7.onrender.com/health

# Test with database check
curl https://tactix-hls7.onrender.com/health?db=true

# Test the keep-alive script once
node keep-alive.js --once --verbose
```

### Verify Render Status

1. Go to your Render dashboard
2. Check the "Events" tab for your service
3. You should see regular activity preventing spin-down

### Verify Supabase Status

1. Go to your Supabase dashboard
2. Check "Database" → "Logs"
3. You should see regular query activity

---

## Cost Considerations

- **Render Free Tier**: 750 hours/month (enough for 1 service running 24/7)
- **Supabase Free Tier**: Unlimited API calls, just needs activity to avoid pause
- **Server**: A small $5/month DigitalOcean/Linode droplet can run this easily
- **Alternative**: Run from your local machine if it's always on

---

## Security Notes

- The `/health` endpoint is public (no authentication required)
- It only returns status information and record counts
- No sensitive data is exposed
- Consider rate limiting if you're concerned about abuse

---

## Alternative Solutions

If you don't have an Ubuntu server, consider:

1. **GitHub Actions**: Run as a scheduled workflow (free for public repos)
2. **Uptime monitoring services**: UptimeRobot, StatusCake (free tiers available)
3. **Cloud Functions**: AWS Lambda, Google Cloud Functions (free tier)
4. **Local machine**: Run on your development machine if it's always on

---

## Support

For issues or questions:
- Check logs: `sudo journalctl -u tactix-keep-alive -f`
- Test manually: `node keep-alive.js --once --verbose`
- Verify endpoint: `curl https://tactix-hls7.onrender.com/health?db=true`
