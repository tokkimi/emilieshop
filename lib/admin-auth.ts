import type { ChatGPTUser } from '../app/chatgpt-auth';

const launchOwnerEmail = 'emilie@equipecauvier.com';

// Accès administrateur complet : ADMIN_EMAILS (fondatrice) + ADMIN_TEST_EMAILS (comptes de test).
export function isAdminUser(user: ChatGPTUser): boolean {
  const configured = [process.env.ADMIN_EMAILS || launchOwnerEmail, process.env.ADMIN_TEST_EMAILS || '']
    .join(',')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  return configured.includes(user.email.trim().toLowerCase());
}
