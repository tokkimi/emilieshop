import type { ChatGPTUser } from '../app/chatgpt-auth';

const launchOwnerEmail = 'emilie@equipecauvier.com';

export function isAdminUser(user: ChatGPTUser): boolean {
  const configured = (process.env.ADMIN_EMAILS || launchOwnerEmail)
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  return configured.includes(user.email.trim().toLowerCase());
}
