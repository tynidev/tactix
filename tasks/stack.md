# IF Deploy to Cloud

## Backend

| Tech            | Role in Stack                              |
| --------------- | ------------------------------------------ |
| **Node.js**     | Run backend server logic                   |
| **Express**     | Define API endpoints + middleware          |
| **Supabase**    | PostgreSQL, Auth, Storage, JWT Sessions    |

## Frontend

| Tech                    | Role in Stack              |
| ----------------------- | -------------------------- |
| **React**               | Build UI                   |
| **jwt-decode**          | Decode JWT for display     |
| **fetch / Axios**       | Call your own backend APIs |
| **Supabase JS SDK**     | Login / upload / query DB  |
| **Supabase Auth + SDK** | Manage user session/JWT    |

## Hosting Services

| Hosting Service  | Component         | Free Limits                                                                     |
| ---------------- | ----------------- | ------------------------------------------------------------------------------- |
| **Supabase.com** | Supabase          | 500 MB DB, 1 GB storage, paused after 7 days idle, no charges                   |
| **Render**       | Node.js + Express | Includes HTTPS, custom domains, managed TLS, auto deploys, sleeps when idle     |
| **Vercel**       | React frontend    | Includes global CDN, 100 GB bandwidth/mo, 1M serverless calls, 6k build minutes |

# IF Deploy Locally

## Backend

| Tech                     | Role in Stack                              |
| ------------------------ | ------------------------------------------ |
| **Node.js**              | Run backend server logic                   |
| **Express**              | Define API endpoints + middleware          |
| **PostgreSQL**           | PostgreSQL                                 |
| **Keycloak/Auth.js/Ory** | Auth                                       |
| **JWT + RSA keypair**    | Session                                    |

## Frontend

| Tech                    | Role in Stack              |
| ----------------------- | -------------------------- |
| **React**               | Build UI                   |
| **jwt-decode**          | Decode JWT for display     |
| **fetch / Axios**       | Call your own backend APIs |
