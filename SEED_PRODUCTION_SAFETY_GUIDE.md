# 🚨 SEED PRODUCTION SAFETY GUIDE

**CRITICAL WARNING**: Running certain seed operations in production WILL cause permanent data loss!

## Table of Contents
- [Critical Risk Summary](#critical-risk-summary)
- [Dangerous Operations by File](#dangerous-operations-by-file)
- [Cascade Delete Impact Analysis](#cascade-delete-impact-analysis)
- [Safe vs Dangerous Seeds](#safe-vs-dangerous-seeds)
- [Production Seed Recommendations](#production-seed-recommendations)

---

## Critical Risk Summary

### 🔴 **NEVER RUN IN PRODUCTION**
1. **`prisma/seed.ts`** - Main seed file (HAS PROTECTION but still dangerous)
2. **Any seed with unprotected `deleteMany({})`** - Causes data loss

### ⚠️ **HIGH RISK - REVIEW CAREFULLY**
1. **`seed-role-permissions-map.ts`** - Deletes and recreates permissions
2. **User upserts with role deletion** - Temporary permission loss

### ✅ **SAFE FOR PRODUCTION**
1. **`seed-roles.ts`** - Only upserts roles
2. **`seed-permissions.ts`** - Only upserts permissions
3. **`seed-countries-states.ts`** - Only upserts location data
4. **`seed-ai-*.ts`** files - Only upserts AI configuration
5. **`seed-storage-tiers.ts`** - Creates with existence check

---

## Dangerous Operations by File

### 1. **prisma/seed.ts** 🟡 HAS ENVIRONMENT PROTECTION

**Lines 15-20: Environment Check EXISTS**
```typescript
// This seed ALREADY has protection:
if (process.env.NODE_ENV === 'production') {
  console.error('Cannot run seed in production environment');
  process.exit(1);
}
```

**Lines 42-66: COMPLETE DATABASE WIPE (Protected by environment check)**
```typescript
// This will DELETE ALL DATA from ALL TABLES
const modelNames = Object.keys(prisma).filter(key => 
  typeof (prisma as any)[key] === 'object' && 
  (prisma as any)[key].deleteMany
);

for (const modelName of modelNames.reverse()) {
  await (prisma as any)[modelName].deleteMany({}); // ⚠️ DELETES EVERYTHING
  console.log(`${modelName} data deleted.`);
}
```

**Impact if run in production:**
- ❌ ALL user accounts deleted
- ❌ ALL company data deleted
- ❌ ALL files and uploads deleted
- ❌ ALL audit logs deleted
- ❌ ALL authentication sessions terminated
- ❌ Complete system failure

### 2. **prisma/dev-seeds/seed-admin-company.ts** 🟡 HAS ENVIRONMENT PROTECTION

**Lines 27-31: Environment Check EXISTS**
```typescript
// This seed ALREADY has protection:
if (process.env.NODE_ENV !== 'development') {
  console.error('This seed should only be run in development environment');
  process.exit(1);
}
```

**Lines 312-318: DELETE ALL USERS (Protected by environment check)**
```typescript
// Deletes ALL users and their related data
await prisma.emailVerification.deleteMany({}); // ⚠️ ALL email verifications
await prisma.user.deleteMany({});              // ⚠️ ALL users
```

**Cascade delete impact:**
- ❌ All user profiles deleted
- ❌ All user sessions terminated
- ❌ All user roles removed
- ❌ All user files orphaned
- ❌ All audit logs orphaned
- ❌ All activity logs deleted

**Lines 403-404: DELETE USER ROLES**
```typescript
roles: {
  deleteMany: {}, // ⚠️ Removes ALL roles from user
  create: user.roles.map(role => ({ /* ... */ }))
}
```

### 3. **prisma/seed-role-permissions-map.ts** ⚠️ HIGH RISK

**Lines 268-272: DELETE ALL ROLE PERMISSIONS**
```typescript
console.log(`Clearing existing permissions for role: ${roleName}`);
await prisma.rolePermission.deleteMany({
  where: { roleId: role.id }, // ⚠️ Deletes ALL permissions for role
});
```

**Risk:**
- If seed fails after deletion but before recreation
- Role would have ZERO permissions
- Users with that role cannot perform ANY actions

---

## Cascade Delete Impact Analysis

### User Deletion Cascade Tree
```
User Delete
├── Sessions (CASCADE) - All user sessions terminated
├── UserProfile (CASCADE) - Profile data lost
├── UserAddress (CASCADE) - Address data lost
├── UserRole (CASCADE) - All role assignments lost
├── Otp (CASCADE) - 2FA data lost
├── RefreshToken (CASCADE) - Tokens invalidated
├── PasswordReset (CASCADE) - Reset history lost
├── EmailVerification (CASCADE) - Verification status lost
├── UserActivityLog (CASCADE) - Activity history lost
├── UserStorageConfig (CASCADE) - Storage settings lost
├── File (SET NULL) - Files orphaned, not deleted
├── AuditLog (SET NULL) - Logs orphaned, preserved
└── BotToken relations (CASCADE/SET NULL) - Bot access affected
```

### Company Deletion Cascade Tree
```
Company Delete
├── CompanySchedules (CASCADE) - Business hours lost
├── CompanyAIAssistant (CASCADE) - AI assignments lost
├── CompanyAIAssistantFeature (CASCADE) - Feature config lost
├── Address (CASCADE) - Company address lost
├── BotToken (CASCADE) - Bot authentication lost
├── AIPersona (CASCADE) - Company personas lost
├── CompanyAIPersona (CASCADE) - Persona assignments lost
└── User.companyId (SET NULL) - Users become company-less
```

### Role Deletion Cascade Tree
```
Role Delete
├── UserRole (CASCADE) - User loses all permissions
└── RolePermission (CASCADE) - Permission mappings lost
```

---

## Safe vs Dangerous Seeds

### ✅ SAFE Seeds (Can run in production)

| File | Operation | Why Safe |
|------|-----------|----------|
| `seed-roles.ts` | `upsert` | Only updates existing or creates new |
| `seed-permissions.ts` | `upsert` | Only updates existing or creates new |
| `seed-countries-states.ts` | `upsert` | Only updates existing or creates new |
| `seed-ai-assistants.ts` | `upsert` | Only updates existing or creates new |
| `seed-ai-assistants-features.ts` | `upsert` | Only updates existing or creates new |
| `seed-ai-personas.ts` | `upsert` | Only updates existing or creates new |
| `seed-storage-tiers.ts` | `create` with check | Checks existence before creating |

### 🔴 DANGEROUS Seeds (NEVER run in production)

| File | Dangerous Operation | Protection | Risk Level |
|------|-------------------|------------|------------|
| `seed.ts` | `deleteMany({})` on ALL tables | ✅ ENV CHECK | 🟡 Protected |
| `seed-admin-company.ts` | `prisma.user.deleteMany({})` | ✅ ENV CHECK | 🟡 Protected |
| `seed-second-company.ts` | Creates test data | ✅ ENV CHECK | 🟡 Protected |
| `seed-role-permissions-map.ts` | `rolePermission.deleteMany()` | ❌ NO CHECK | 🔴 DANGEROUS |

---

## Production Seed Recommendations

### 1. Create Production-Safe Seed Script

Create a new `seed-production.ts` that:
```typescript
// PRODUCTION SAFE SEED - NO DELETES
async function seedProduction() {
  // Only use upsert for critical data
  await prisma.role.upsert({
    where: { name: 'admin' },
    update: {}, // No updates, just ensure exists
    create: { /* ... */ }
  });
  
  // Never use deleteMany
  // Never use delete
  // Never use truncate
}
```

### 2. Add Environment Guards

```typescript
// Add to ALL seed files with delete operations
if (process.env.NODE_ENV === 'production') {
  console.error('❌ CANNOT RUN THIS SEED IN PRODUCTION!');
  console.error('This seed contains destructive operations.');
  process.exit(1);
}

// Double-check protection
if (process.env.DATABASE_URL?.includes('prod')) {
  console.error('❌ Production database detected!');
  process.exit(1);
}
```

### 3. Separate Seed Commands

Update `package.json`:
```json
{
  "scripts": {
    "db:seed:dev": "NODE_ENV=development ts-node prisma/seed.ts",
    "db:seed:prod": "NODE_ENV=production ts-node prisma/seed-production.ts",
    "db:seed:dangerous": "echo 'Are you SURE? This will DELETE data!' && npm run db:seed:dev"
  }
}
```

### 4. Production Seed Checklist

Before running ANY seed in production:

- [ ] ❌ Does it contain `deleteMany()`? **DO NOT RUN**
- [ ] ❌ Does it contain `delete()`? **DO NOT RUN**
- [ ] ❌ Does it contain `$executeRaw` with DELETE/TRUNCATE? **DO NOT RUN**
- [ ] ⚠️ Does it use `upsert` with role deletion? **REVIEW CAREFULLY**
- [ ] ✅ Does it only use `upsert` without deletion? **SAFE**
- [ ] ✅ Does it only use `create` with existence checks? **SAFE**
- [ ] ✅ Is it specifically designed for production? **SAFE**

### 5. Emergency Recovery Plan

If seeds are accidentally run in production:

1. **IMMEDIATELY stop the seed process**
2. **Check database for data loss** - Run counts on critical tables
3. **Restore from backup** if data loss occurred
4. **Review audit logs** to understand impact
5. **Notify affected users** if their data was impacted
6. **Update seed files** with stronger guards

---

## Code to Add for Production Safety

Add this to the top of ALL dangerous seed files:

```typescript
// PRODUCTION SAFETY CHECK
const isDangerous = true; // Set for files with delete operations

if (isDangerous && process.env.NODE_ENV === 'production') {
  console.error(`
    ╔════════════════════════════════════════╗
    ║  🚨 PRODUCTION SAFETY CHECK FAILED 🚨  ║
    ╠════════════════════════════════════════╣
    ║  This seed contains DANGEROUS          ║
    ║  operations that will DELETE DATA!     ║
    ║                                        ║
    ║  Running this in production will:      ║
    ║  - Delete user data                    ║
    ║  - Remove permissions                  ║
    ║  - Cause system failure                ║
    ║                                        ║
    ║  DO NOT PROCEED!                      ║
    ╚════════════════════════════════════════╝
  `);
  process.exit(1);
}

// Additional check for production database URL
if (process.env.DATABASE_URL?.includes('prod') || 
    process.env.DATABASE_URL?.includes('render') ||
    process.env.DATABASE_URL?.includes('railway')) {
  console.error('Production database detected in DATABASE_URL!');
  process.exit(1);
}
```

---

## Final Warning

**NEVER** run the following command in production:
```bash
# ❌ NEVER DO THIS IN PRODUCTION
npm run db:seed

# ❌ NEVER DO THIS EITHER
ts-node prisma/seed.ts

# ❌ ESPECIALLY NOT THIS
npx prisma db seed
```

**ONLY** run production-safe seeds:
```bash
# ✅ SAFE - Only if seed-production.ts exists and is safe
npm run db:seed:prod
```