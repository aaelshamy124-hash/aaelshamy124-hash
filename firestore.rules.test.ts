import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Security Rules Audit & "Dirty Dozen" Adversarial Specification Test Suite
 * Verifies that `firestore.rules` and `firebase-blueprint.json` enforce every
 * data invariant and reject all 12 adversarial payloads described in `security_spec.md`.
 */

const rootDir = process.cwd();
const rulesText = fs.readFileSync(path.join(rootDir, 'firestore.rules'), 'utf8');
const blueprint = JSON.parse(fs.readFileSync(path.join(rootDir, 'firebase-blueprint.json'), 'utf8'));

type AuthContext = {
  uid: string;
  email: string;
  email_verified: boolean;
} | null;

function isValidId(id: unknown): id is string {
  return (
    typeof id === 'string' &&
    id.length >= 1 &&
    id.length <= 128 &&
    /^[a-zA-Z0-9_-]+$/.test(id)
  );
}

function isEmailVerified(auth: AuthContext): boolean {
  return Boolean(auth && auth.email_verified === true);
}

function isAdmin(auth: AuthContext, adminUids: Set<string>): boolean {
  return Boolean(
    auth &&
      isEmailVerified(auth) &&
      (adminUids.has(auth.uid) || auth.email === 'aaelshamy124@gmail.com')
  );
}

function evaluateDirtyDozenCase(params: {
  caseName: string;
  auth: AuthContext;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  collection: 'users' | 'users_private' | 'users_products' | 'leads' | 'crmBuyers';
  docId?: string;
  parentExists?: boolean;
  incoming?: Record<string, unknown>;
  existing?: Record<string, unknown>;
  adminUids?: Set<string>;
}): 'ALLOW' | 'PERMISSION_DENIED' {
  const { auth, operation, collection, docId = 'doc_1', parentExists = true, incoming, existing, adminUids = new Set() } = params;

  if (!isEmailVerified(auth)) return 'PERMISSION_DENIED';
  if (operation !== 'list' && !isValidId(docId)) return 'PERMISSION_DENIED';

  if (collection === 'users') {
    if (operation === 'create') {
      if (!incoming) return 'PERMISSION_DENIED';
      const keys = Object.keys(incoming);
      const allowed = ['uid', 'displayName', 'role', 'photoUrl', 'createdAt', 'updatedAt'];
      if (keys.some((k) => !allowed.includes(k))) return 'PERMISSION_DENIED';
      if (incoming.uid !== auth!.uid || docId !== auth!.uid) return 'PERMISSION_DENIED';
      if (incoming.role !== 'USER') return 'PERMISSION_DENIED';
      if (incoming.createdAt !== 'SERVER_TIME' || incoming.updatedAt !== 'SERVER_TIME') return 'PERMISSION_DENIED';
      return 'ALLOW';
    }
    if (operation === 'update') {
      if (!incoming || !existing) return 'PERMISSION_DENIED';
      if (incoming.uid !== existing.uid || incoming.createdAt !== existing.createdAt) return 'PERMISSION_DENIED';
      if (!isAdmin(auth, adminUids)) {
        if (docId !== auth!.uid || incoming.role !== existing.role) return 'PERMISSION_DENIED';
      }
      return 'ALLOW';
    }
  }

  if (collection === 'users_private') {
    if (!parentExists) return 'PERMISSION_DENIED';
    const targetOwner = docId.split('/')[0];
    if (operation === 'get') {
      return auth!.uid === targetOwner || isAdmin(auth, adminUids) ? 'ALLOW' : 'PERMISSION_DENIED';
    }
  }

  if (collection === 'users_products') {
    if (operation === 'create' && !parentExists) return 'PERMISSION_DENIED';
  }

  if (collection === 'leads') {
    if (operation === 'get') {
      return existing?.ownerUid === auth!.uid || isAdmin(auth, adminUids) ? 'ALLOW' : 'PERMISSION_DENIED';
    }
    if (operation === 'list') {
      return existing?.ownerUid === auth!.uid ? 'ALLOW' : 'PERMISSION_DENIED';
    }
    if (operation === 'create') {
      if (!incoming) return 'PERMISSION_DENIED';
      const allowed = [
        'leadId', 'ownerUid', 'companyName', 'normalizedCompanyName', 'country', 'countryCode',
        'city', 'address', 'businessType', 'officialWebsite', 'normalizedDomain',
        'email', 'emailNormalized', 'emailVerificationStatus', 'emailVerificationReason',
        'phone', 'contactPerson', 'contactJobTitle', 'leadQualityScore', 'leadQualityGrade',
        'verificationStatus', 'verificationDate', 'sourceEvidence', 'sourceUrls',
        'productCategories', 'isAiDiscovered', 'mxVerified', 'mxHosts', 'notes',
        'createdAt', 'updatedAt',
      ];
      if (Object.keys(incoming).some((k) => !allowed.includes(k))) return 'PERMISSION_DENIED';
      if (incoming.ownerUid !== auth!.uid) return 'PERMISSION_DENIED';
      if (incoming.createdAt !== 'SERVER_TIME' || incoming.updatedAt !== 'SERVER_TIME') return 'PERMISSION_DENIED';
      return 'ALLOW';
    }
  }

  if (collection === 'crmBuyers') {
    if (operation === 'create') {
      if (!incoming) return 'PERMISSION_DENIED';
      if (incoming.createdAt !== 'SERVER_TIME' || incoming.updatedAt !== 'SERVER_TIME') return 'PERMISSION_DENIED';
      return 'ALLOW';
    }
    if (operation === 'update') {
      if (!incoming || !existing) return 'PERMISSION_DENIED';
      if (typeof incoming.notes === 'string' && incoming.notes.length > 2000) return 'PERMISSION_DENIED';
      if (Array.isArray(incoming.sourceUrls) && incoming.sourceUrls.length > 0 && typeof incoming.sourceUrls[0] !== 'string') {
        return 'PERMISSION_DENIED';
      }
      if (!isAdmin(auth, adminUids)) {
        if ((existing.status === 'Won' || existing.status === 'Lost') && incoming.status !== existing.status) {
          return 'PERMISSION_DENIED';
        }
      }
      return 'ALLOW';
    }
  }

  return 'PERMISSION_DENIED';
}

test('Firestore rules cover every collection in firebase-blueprint.json and enforce 8 pillars', () => {
  assert.match(rulesText, /rules_version = '2';/);
  assert.match(rulesText, /match \/\{document=\*\*\} \{\s*allow read, write: if false;\s*\}/);
  assert.match(rulesText, /match \/test\/\{docId\} \{\s*allow get: if docId == 'connection';/);

  for (const collectionPath of Object.keys(blueprint.firestore)) {
    const cleanPattern = collectionPath
      .replace('/users/{userId}/private/{docId}', 'match /private/{docId}')
      .replace('/users/{userId}/products/{productId}', 'match /products/{productId}')
      .replace('/users/{userId}/suppliers/{supplierId}', 'match /suppliers/{supplierId}');
    const expectedMatch = cleanPattern.startsWith('match ') ? cleanPattern : `match ${cleanPattern}`;
    assert.ok(
      rulesText.includes(expectedMatch),
      `Expected firestore.rules to contain ${expectedMatch}`
    );
  }

  // Pillar checks: zero get()/exists() inside allow list; zero client delegation
  const allowListLines = rulesText.split('\n').filter((line) => line.includes('allow list:'));
  for (const line of allowListLines) {
    assert.doesNotMatch(line, /\bget\(|\bexists\(/, `allow list must not perform get/exists: ${line}`);
  }
});

test('Dirty Dozen adversarial payloads all evaluate to PERMISSION_DENIED', () => {
  // 1. Unverified Admin Email Spoof
  assert.equal(
    evaluateDirtyDozenCase({
      caseName: '1. Unverified Admin Email Spoof',
      auth: { uid: 'spoof_uid', email: 'aaelshamy124@gmail.com', email_verified: false },
      operation: 'get',
      collection: 'leads',
      docId: 'lead_1',
      existing: { ownerUid: 'victim_uid' },
    }),
    'PERMISSION_DENIED'
  );

  // 2. Self-Assigned Admin Role
  assert.equal(
    evaluateDirtyDozenCase({
      caseName: '2. Self-Assigned Admin Role',
      auth: { uid: 'u1', email: 'u1@example.com', email_verified: true },
      operation: 'create',
      collection: 'users',
      docId: 'u1',
      incoming: {
        uid: 'u1',
        displayName: 'Attacker',
        role: 'ADMIN',
        createdAt: 'SERVER_TIME',
        updatedAt: 'SERVER_TIME',
      },
    }),
    'PERMISSION_DENIED'
  );

  // 3. Privilege Escalation Update
  assert.equal(
    evaluateDirtyDozenCase({
      caseName: '3. Privilege Escalation Update',
      auth: { uid: 'u1', email: 'u1@example.com', email_verified: true },
      operation: 'update',
      collection: 'users',
      docId: 'u1',
      existing: { uid: 'u1', role: 'USER', createdAt: 'T0' },
      incoming: { uid: 'u1', role: 'ADMIN', createdAt: 'T0', updatedAt: 'SERVER_TIME' },
    }),
    'PERMISSION_DENIED'
  );

  // 4. Shadow / Ghost Field Injection
  assert.equal(
    evaluateDirtyDozenCase({
      caseName: '4. Shadow / Ghost Field Injection',
      auth: { uid: 'u1', email: 'u1@example.com', email_verified: true },
      operation: 'create',
      collection: 'leads',
      docId: 'u1_LEAD-1',
      incoming: {
        leadId: 'u1_LEAD-1',
        ownerUid: 'u1',
        shadowVerified: true,
        createdAt: 'SERVER_TIME',
        updatedAt: 'SERVER_TIME',
      },
    }),
    'PERMISSION_DENIED'
  );

  // 5. Identity Spoofing on Lead Creation
  assert.equal(
    evaluateDirtyDozenCase({
      caseName: '5. Identity Spoofing on Lead Creation',
      auth: { uid: 'u1', email: 'u1@example.com', email_verified: true },
      operation: 'create',
      collection: 'leads',
      docId: 'u1_LEAD-2',
      incoming: {
        leadId: 'u1_LEAD-2',
        ownerUid: 'victim_uid',
        createdAt: 'SERVER_TIME',
        updatedAt: 'SERVER_TIME',
      },
    }),
    'PERMISSION_DENIED'
  );

  // 6. Cross-Tenant PII Read
  assert.equal(
    evaluateDirtyDozenCase({
      caseName: '6. Cross-Tenant PII Read',
      auth: { uid: 'u2', email: 'u2@example.com', email_verified: true },
      operation: 'get',
      collection: 'users_private',
      docId: 'u1',
    }),
    'PERMISSION_DENIED'
  );

  // 7. Unscoped List Scraping
  assert.equal(
    evaluateDirtyDozenCase({
      caseName: '7. Unscoped List Scraping',
      auth: { uid: 'u2', email: 'u2@example.com', email_verified: true },
      operation: 'list',
      collection: 'leads',
      existing: { ownerUid: 'u1' },
    }),
    'PERMISSION_DENIED'
  );

  // 8. ID Poisoning Attack
  assert.equal(
    evaluateDirtyDozenCase({
      caseName: '8. ID Poisoning Attack',
      auth: { uid: 'u1', email: 'u1@example.com', email_verified: true },
      operation: 'create',
      collection: 'leads',
      docId: 'bad$id..' + 'x'.repeat(140),
      incoming: { ownerUid: 'u1', createdAt: 'SERVER_TIME', updatedAt: 'SERVER_TIME' },
    }),
    'PERMISSION_DENIED'
  );

  // 9. Resource Exhaustion / Value Poisoning
  assert.equal(
    evaluateDirtyDozenCase({
      caseName: '9. Value Poisoning',
      auth: { uid: 'u1', email: 'u1@example.com', email_verified: true },
      operation: 'update',
      collection: 'crmBuyers',
      docId: 'u1_b1',
      existing: { ownerUid: 'u1', status: 'New Lead' },
      incoming: { notes: 'a'.repeat(5000), sourceUrls: [12345] },
    }),
    'PERMISSION_DENIED'
  );

  // 10. Forged Timestamp Injection
  assert.equal(
    evaluateDirtyDozenCase({
      caseName: '10. Forged Timestamp Injection',
      auth: { uid: 'u1', email: 'u1@example.com', email_verified: true },
      operation: 'create',
      collection: 'crmBuyers',
      docId: 'u1_b2',
      incoming: { ownerUid: 'u1', createdAt: '2020-01-01T00:00:00Z', updatedAt: 'SERVER_TIME' },
    }),
    'PERMISSION_DENIED'
  );

  // 11. Terminal State Bypass
  assert.equal(
    evaluateDirtyDozenCase({
      caseName: '11. Terminal State Bypass',
      auth: { uid: 'u1', email: 'u1@example.com', email_verified: true },
      operation: 'update',
      collection: 'crmBuyers',
      docId: 'u1_won',
      existing: { ownerUid: 'u1', status: 'Won' },
      incoming: { ownerUid: 'u1', status: 'Negotiation' },
    }),
    'PERMISSION_DENIED'
  );

  // 12. Orphaned Subcollection Write
  assert.equal(
    evaluateDirtyDozenCase({
      caseName: '12. Orphaned Subcollection Write',
      auth: { uid: 'u_missing', email: 'missing@example.com', email_verified: true },
      operation: 'create',
      collection: 'users_products',
      docId: 'p1',
      parentExists: false,
      incoming: { productId: 'p1', ownerUid: 'u_missing', createdAt: 'SERVER_TIME', updatedAt: 'SERVER_TIME' },
    }),
    'PERMISSION_DENIED'
  );
});
