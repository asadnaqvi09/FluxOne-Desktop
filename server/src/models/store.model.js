/**
 * Store profile — invoice footer (contact, warning, return instructions)
 */
import { connectDb } from '../config/database.js';

const PROFILE_SELECT = `
  SELECT name, contact_phone AS contactPhone, contact_email AS contactEmail,
         address, warning_message AS warningMessage,
         return_instructions AS returnInstructions,
         shop_open_time AS shopOpenTime, shop_close_time AS shopCloseTime,
         currency
  FROM store_profile
  WHERE id = 'store'
`;

/** Ensure singleton row exists (cloud-only boot skips seed). */
export function ensureProfile() {
  const db = connectDb();
  db.prepare(
    `
    INSERT INTO store_profile (
      id, name, contact_phone, contact_email, address,
      warning_message, return_instructions,
      shop_open_time, shop_close_time, currency
    ) VALUES (
      'store', '', NULL, NULL, NULL,
      NULL, NULL,
      '09:00', '18:00', 'PKR'
    )
    ON CONFLICT(id) DO NOTHING
  `
  ).run();
}

export function getProfile() {
  ensureProfile();
  const db = connectDb();
  return db.prepare(PROFILE_SELECT).get() || null;
}

export function updateProfile(fields) {
  ensureProfile();
  const db = connectDb();
  db.prepare(
    `
    UPDATE store_profile SET
      name = COALESCE(@name, name),
      contact_phone = COALESCE(@contactPhone, contact_phone),
      contact_email = COALESCE(@contactEmail, contact_email),
      address = COALESCE(@address, address),
      warning_message = COALESCE(@warningMessage, warning_message),
      return_instructions = COALESCE(@returnInstructions, return_instructions),
      updated_at = datetime('now')
    WHERE id = 'store'
  `
  ).run({
    name: fields.name ?? null,
    contactPhone: fields.contactPhone ?? null,
    contactEmail: fields.contactEmail ?? null,
    address: fields.address ?? null,
    warningMessage: fields.warningMessage ?? null,
    returnInstructions: fields.returnInstructions ?? null,
  });
  return getProfile();
}
