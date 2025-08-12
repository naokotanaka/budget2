# Code Style & Conventions for nagaiku-budget-v2

## Language Rules
- **Variables, functions, classes**: English
- **Technical keywords**: English  
- **Test descriptions**: English
- **Business logic comments**: Japanese
- **User-facing messages**: Japanese

## TypeScript Rules
- **Avoid `any` or `unknown` types** - Use specific type definitions
- **Do not use `class`** unless necessary (e.g., extending Error)
- **Use interfaces for complex type definitions**
- **Prefer type unions over loose typing**

## Code Structure
- **Avoid hard-coding values** - Use constants or configuration
- **Use meaningful variable names** in English
- **Comment business logic** in Japanese for clarity
- **Keep functions focused and single-purpose**

## SvelteKit Conventions
- **Use `+page.svelte`** for route pages
- **Use `+page.server.ts`** for server-side data loading
- **Use `+layout.svelte`** for shared layouts
- **Store shared logic in `src/lib/`**

## File Organization
```
src/
├── routes/           # SvelteKit routes
├── lib/
│   ├── components/   # Reusable UI components  
│   ├── server/       # Server-side utilities
│   ├── utils/        # Client-side utilities
│   └── types/        # TypeScript type definitions
├── app.html         # HTML template
└── app.css          # Global styles
```

## Component Naming
- **PascalCase** for component files and names
- **kebab-case** for HTML elements and CSS classes
- **camelCase** for JavaScript variables and functions

## API Conventions
- **RESTful endpoints** following SvelteKit patterns
- **Use Zod for validation** of request/response data
- **Return consistent response format**:
```typescript
{
  success: boolean,
  data?: any,
  error?: string,
  detail?: string (development only)
}
```

## Database Conventions
- **Use Prisma ORM** for all database operations
- **snake_case** for database column names
- **camelCase** for Prisma model fields
- **Include audit fields**: createdAt, updatedAt
- **Use transactions** for multi-table operations