'use strict';

const fs = require('fs');
const path = require('path');

const requiredFiles = [
  'firebase.json',
  'firestore.rules',
  'firestore.indexes.json'
];

const failures = [];
const reportPath = path.join(process.cwd(), 'dist', 'firebase-predeploy-report.json');

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(process.cwd(), file))) {
    failures.push(`Missing required Firebase file: ${file}`);
  }
}

if (!failures.length) {
  const firebaseConfig = JSON.parse(fs.readFileSync('firebase.json', 'utf8'));
  if (!firebaseConfig.firestore) {
    failures.push('firebase.json is missing firestore configuration.');
  } else {
    if (firebaseConfig.firestore.rules !== 'firestore.rules') {
      failures.push('firebase.json must point firestore.rules to firestore.rules.');
    }
    if (firebaseConfig.firestore.indexes !== 'firestore.indexes.json') {
      failures.push('firebase.json must point firestore.indexes to firestore.indexes.json.');
    }
  }
}

if (!failures.length) {
  const rules = fs.readFileSync('firestore.rules', 'utf8');
  const dangerousPatterns = [
    /allow\s+(read|write|create|update|delete)\s*:\s*if\s+true\s*;/,
    /allow\s+(read|write)\s*:\s*if\s+request\.auth\s*==\s*null\s*;/,
    /match\s+\/\{document=\*\*\}\s*\{[\s\S]*allow\s+(read|write)\s*:\s*if\s+true\s*;/m
  ];

  dangerousPatterns.forEach((pattern) => {
    if (pattern.test(rules)) {
      failures.push(`Unsafe Firestore rule pattern found: ${pattern}`);
    }
  });

  [
    'request.auth != null',
    'request.auth.uid == userId',
    'users/{userId}',
    'sharedProjects/{projectId}',
    "['owner', 'editor', 'viewer']"
  ].forEach((needle) => {
    if (!rules.includes(needle)) {
      failures.push(`Expected Firestore guardrail not found: ${needle}`);
    }
  });
}

if (failures.length) {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify({
    name: 'AirCalc Pro Firebase predeploy report',
    generatedAt: new Date().toISOString(),
    status: 'failed',
    failures
  }, null, 2));
  console.error('Firebase predeploy check failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, JSON.stringify({
  name: 'AirCalc Pro Firebase predeploy report',
  generatedAt: new Date().toISOString(),
  status: 'passed',
  failures: []
}, null, 2));

console.log('Firebase predeploy check passed.');
