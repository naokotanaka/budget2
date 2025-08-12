# nagaiku-budget-v2 Project Overview

## Project Purpose
NPO法人ながいくの予算管理システム改良版。1対多予算項目割当機能を持つ財務管理システムで、freee API連携による取引データ自動同期を実現。

## Tech Stack
- **Frontend**: SvelteKit 2.x, TypeScript 5.x, Tailwind CSS 3.x
- **UI Library**: Tabulator Tables 6.x (データグリッド)
- **Backend**: Node.js 18+, Prisma 6.x ORM
- **Database**: PostgreSQL 13+ (dev: nagaiku_budget_v2_dev, prod: nagaiku_budget_v2_prod)
- **Validation**: Zod 4.x
- **External API**: freee API (OAuth2認証)

## Port Configuration
- **Development**: PORT 3002
- **Production**: PORT 3002  
- **CRITICAL**: Port changes are forbidden due to Nginx integration

## Environment URLs
- **Production**: https://nagaiku.top/budget2/
- **Development**: https://localhost:3002 (HTTPS required)
- **Testing**: Use `timeout 10 curl -k https://nagaiku.top/budget2/grants`

## tmux Sessions
- **Development sessions**: nagaiku-dev, dev-budget
- **Start command**: `PORT=3002 npm run dev`
- **Development MUST use tmux** (NOT systemctl)
- **Production uses systemd** for service management