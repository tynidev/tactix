# Migrating from Cloud Stack to Local Self-Hosted Stack

This guide outlines the steps to transition your app from a cloud-hosted stack (Supabase, Render, Vercel) to a fully self-hosted stack using Supabase, 
Mailcow, NGINX, and your React/Node application.

---

## 1. Prepare Local Infrastructure

- Set up a single physical server with Docker containerization for all services (recommended approach)
- Use Docker Compose to orchestrate Supabase, Mailcow, NGINX, and your app
- Configure Docker volumes for persistent data storage
- Set up automated backups for Docker volumes and container configurations
- Install monitoring tools (e.g., Portainer for Docker management, Prometheus/Grafana for system monitoring)

### Minimum Server Requirements:
- **CPU**: 4+ cores
- **RAM**: 16GB minimum (32GB recommended)
- **Storage**: 500GB+ SSD
- **OS**: Ubuntu Server 22.04 LTS or similar

## 2. Supabase for PostgreSQL, Auth, Storage Buckets


## 3. Configure Mailcow for Email

- Install Mailcow as your local SMTP server.
- Set up domains, mailboxes, and SMTP credentials.
- Update your app to use Mailcow for sending emails (password resets, notifications, etc.).

## 4. Set Up NGINX with HTTPS

- Install NGINX as a reverse proxy for your backend and frontend.
- Obtain TLS certificates (e.g., via Let's Encrypt).
- Configure NGINX to route traffic securely to Supabase, your app, and Mailcow.

## 5. Update Your App (React/Node)

- Replace Supabase Auth with OpenID Connect integration using Supabase.
- Update backend to use local PostgreSQL instead of Supabase.
- Remove Supabase SDK dependencies from frontend and backend.
- Implement JWT validation and session management using Supabase.
- Update API endpoints and database queries as needed.

## 6. Testing and Validation

- Test authentication, authorization, and user flows with Supabase.
- Verify database operations with PostgreSQL.
- Confirm email delivery via Mailcow.
- Check HTTPS and routing through NGINX.
- Ensure all app features work as expected.

## 7. Documentation and Maintenance

- Document all configuration steps and credentials.
- Set up regular backups for PostgreSQL and Mailcow.
- Monitor service health and security updates.

---

**Summary:**  
Migrating to a local stack involves installing and configuring each service, migrating data and users, updating your app for new integrations, and validating the complete workflow. This approach gives you full control over your infrastructure and data.
