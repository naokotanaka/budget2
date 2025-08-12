# Suggested Commands for nagaiku-budget-v2

## Development Commands
```bash
# Start development server (MUST use tmux)
tmux new-session -d -s nagaiku-dev
tmux send-keys -t nagaiku-dev "cd /home/tanaka/projects/nagaiku-budget-v2 && PORT=3002 npm run dev" Enter

# Clean development start
npm run dev:clean
./universal-dev-clean.sh

# Simple development start
npm run dev:simple
./dev-clean-start.sh
```

## Database Commands
```bash
# Prisma operations
npm run db:push       # Push schema to database
npm run db:seed       # Seed database with initial data
npm run db:studio     # Open Prisma Studio

# Direct PostgreSQL access
PGPASSWORD=$DB_PASSWORD psql -h localhost -U nagaiku_user -d nagaiku_budget_v2_dev
```

## Build & Production
```bash
# Build application
npm run build

# Start production (uses systemd, not tmux)
sudo systemctl start nagaiku-budget-v2
sudo systemctl status nagaiku-budget-v2
sudo systemctl restart nagaiku-budget-v2
```

## Testing Commands
```bash
# Test application endpoints
timeout 10 curl -k https://nagaiku.top/budget2/grants
timeout 10 curl -k https://localhost:3002/grants

# Check port usage
sudo ss -tlnp | grep 3002

# Check tmux sessions
tmux list-sessions
tmux attach -t nagaiku-dev
```

## Code Quality
```bash
# Type checking
npm run check
npm run check:watch

# SvelteKit sync (before type checking)
npm run prepare
```

## System Commands (Linux)
```bash
# File operations
ls -la
find . -name "*.svelte" -type f
grep -r "pattern" src/

# Git operations
git status
git add .
git commit -m "message"
git push

# Process management
ps aux | grep node
pkill -f "npm run dev"
```

## Monitoring & Debugging
```bash
# Check application logs
tail -f logs/app.log

# Check system resources
htop
free -h
df -h

# Network troubleshooting
netstat -tulnp | grep :3002
curl -k https://localhost:3002/api/grants
```