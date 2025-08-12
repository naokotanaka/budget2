# Task Completion Checklist for nagaiku-budget-v2

## When a Development Task is Completed

### 1. Code Quality Checks
```bash
# Type checking
npm run check

# SvelteKit sync
npm run prepare
```

### 2. Testing
```bash
# Test main application endpoints
timeout 10 curl -k https://nagaiku.top/budget2/grants
timeout 10 curl -k https://localhost:3002/api/grants

# Verify development server
tmux list-sessions
tmux attach -t nagaiku-dev  # Check if dev server is running
```

### 3. Database Operations (if applicable)
```bash
# Apply schema changes
npm run db:push

# Verify database connection
PGPASSWORD=$DB_PASSWORD psql -h localhost -U nagaiku_user -d nagaiku_budget_v2_dev -c "SELECT version();"
```

### 4. Production Build Test (for significant changes)
```bash
# Build application
npm run build

# Test production build locally
npm run preview
```

### 5. Git Operations
```bash
# Stage changes
git add .

# Commit with descriptive message
git commit -m "feature: description of changes

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"

# Verify commit
git status
```

### 6. Service Management (Production)
```bash
# For production deployment
sudo systemctl restart nagaiku-budget-v2
sudo systemctl status nagaiku-budget-v2

# Check logs
journalctl -u nagaiku-budget-v2 -f
```

### 7. Monitoring & Verification
```bash
# Check resource usage
htop
free -h

# Verify application is responding
curl -k -I https://nagaiku.top/budget2/

# Check for errors in logs
tail -n 50 logs/app.log
```

## Critical Reminders
- **NEVER change PORT 3002** (breaks Nginx integration)
- **Use HTTPS only** - HTTP will not work
- **Development uses tmux** - Production uses systemd
- **Test on actual URLs** - localhost may not work on VPS