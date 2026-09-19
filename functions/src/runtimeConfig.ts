import {defineString} from 'firebase-functions/params';

export const adminEmail = defineString('TELEMARK_ADMIN_EMAIL', {default: ''});

const allowedOrigins = defineString('TELEMARK_ALLOWED_ORIGINS', {
  default: 'https://telemarkfirst.github.io',
});

export function callableCors(): Array<string | RegExp> {
  const configured = allowedOrigins.value()
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  return [...new Set(configured), /^http:\/\/localhost:\d+$/];
}
