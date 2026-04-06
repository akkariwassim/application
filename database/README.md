# Database — Smart Virtual Fence System

## Requirements
- MySQL 8.0+ (or Docker with `mysql:8.0` image)

## Setup

### Option A — Direct MySQL
```bash
mysql -u root -p < schema.sql
mysql -u root -p < sample_data.sql   # optional dev seed
```

### Option B — Docker
```bash
docker run -d \
  --name smart-fence-db \
  -e MYSQL_ROOT_PASSWORD=rootpass \
  -e MYSQL_DATABASE=smart_fence \
  -p 3306:3306 \
  mysql:8.0

# Wait ~10s for MySQL to start, then:
docker exec -i smart-fence-db mysql -u root -prootpass < schema.sql
docker exec -i smart-fence-db mysql -u root -prootpass < sample_data.sql
```

### Option C — docker-compose (from project root)
```bash
docker-compose up -d db
```

## Schema Overview

| Table           | Description                                      |
|-----------------|--------------------------------------------------|
| `users`         | Farmer/admin accounts                            |
| `animals`       | Livestock inventory linked to users              |
| `geofences`     | Circle or polygon safety zones per animal        |
| `positions`     | GPS history (optimised indexes for time queries) |
| `alerts`        | Geofence breach and system alerts                |
| `refresh_tokens`| JWT refresh token store                          |
| `audit_logs`    | Action traceability                              |

## Sample Credentials (seed data)
| Email             | Password       | Role   |
|-------------------|----------------|--------|
| ahmed@farm.tn     | Password123!   | farmer |
| sara@farm.tn      | Password123!   | farmer |
| admin@fence.io    | Password123!   | admin  |
