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

### 2.1 Set Up Self-Hosted Supabase
- Deploy Supabase using Docker Compose (includes PostgreSQL, PostgREST, GoTrue auth, Storage, etc.)
- Configure Supabase with proper environment variables and secrets
- Set up persistent volumes for PostgreSQL data and storage buckets
- Configure network settings for internal Docker communication

### 2.2 Database Migration
- **Export existing data** from your remote Supabase instance:
  - Dump PostgreSQL schema and data using `pg_dump` or Supabase CLI
  - Export all tables: `user_profiles`, `player_profiles`, `teams`, `team_join_codes`, `team_memberships`, `team_players`, `guardian_player_relationships`, `games`, `coaching_points`, `coaching_point_events`, `coaching_point_tagged_players`, `labels`, `coaching_point_labels`, `coaching_point_acknowledgments`
- **Apply your existing migrations** to the local Supabase instance (from `supabase/migrations/` directory)
- **Import the data** to your local PostgreSQL instance
- **Verify data integrity** and foreign key relationships

### 2.3 Authentication Migration
- Configure GoTrue (Supabase Auth) with your domain and SMTP settings
- **Export user accounts** from remote Supabase (if possible via API/admin tools)
- **Import user accounts** to local instance or plan for user re-registration
- Update JWT secrets and configure session management
- Set up email templates for password reset, confirmation, etc.

### 2.4 Storage Buckets Migration
- **Download all files** from remote Supabase storage bucket (`coaching-audio` bucket based on your migrations)
- **Set up local storage buckets** with same structure and policies
- **Upload files** to local storage
- **Update storage policies** and access controls to match your current setup

### 2.5 Configuration Updates
- **Update connection strings** in your backend (`backend/src/utils/supabase.ts`)
- **Update Supabase URL and anon key** in both backend and frontend
- **Configure CORS** for your local domains
- **Update environment variables** in `.env` files for both backend and frontend

### 2.6 API and SDK Integration
- Ensure PostgREST is properly configured for your database schema
- Test all API endpoints that interact with Supabase
- Verify Supabase JS SDK functionality in frontend
- Update any hardcoded URLs or endpoints


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
