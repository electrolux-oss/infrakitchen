## Infrakitchen Backend

### Features

#### Scheduler

The **Scheduler** is a background service that executes scheduled jobs of type SQL or BASH.
It enables users with super admin access to define and manage jobs using cron-based scheduling.

**Job Management API**

- Create Job: `POST /scheduler/jobs`
*(Requires super admin access)*
- List Jobs: `GET /scheduler/jobs`

Each scheduler job includes the following fields:

```json
{
  "id": "7086669e-7504-4766-b888-eefe83aedaef",
  "type": "SQL",
  "script": "DELETE from logs WHERE expire_at IS NOT NULL AND expire_at <= CURRENT_DATE - INTERVAL '5 days'",
  "cron": "*/5 * * * *",
  "created_at": "2025-07-07T14:02:09+00:00"
}
```

Jobs are stored in the `scheduler_jobs` table in the database.

**How It Works**

1. The Scheduler service, running as a dedicated instance, loads jobs from the database and refreshes the job list every 10 minutes.
2. When a job is triggered based on its cron schedule, the scheduler sends an event through RabbitMQ.
3. A **task worker** receives the event and executes the job based on its type and script.
