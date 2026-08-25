import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(), email: text('email').notNull(), displayName: text('display_name'), role: text('role').notNull().default('customer'), createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});
export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(), ownerId: text('owner_id').notNull().references(() => users.id), title: text('title').notNull(), address: text('address'), years: text('years'), collection: text('collection').notNull().default('Essentiel'), coverColor: text('cover_color').notNull().default('forest'), status: text('status').notNull().default('draft'), progress: integer('progress').notNull().default(10), answersJson: text('answers_json').notNull().default('{}'), optionsJson: text('options_json').notNull().default('[]'), createdAt: integer('created_at', { mode: 'timestamp' }).notNull(), updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, (table) => [index('idx_projects_owner_updated').on(table.ownerId, table.updatedAt)]);
export const media = sqliteTable('media', {
  id: text('id').primaryKey(), projectId: text('project_id').notNull().references(() => projects.id), ownerId: text('owner_id').notNull().references(() => users.id), objectKey: text('object_key').notNull().unique(), filename: text('filename').notNull(), contentType: text('content_type').notNull(), sizeBytes: integer('size_bytes').notNull(), kind: text('kind').notNull().default('photo'), createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
}, (table) => [index('idx_media_project_id').on(table.projectId)]);
export const orders = sqliteTable('orders', {
  id: text('id').primaryKey(), projectId: text('project_id').notNull().references(() => projects.id), ownerId: text('owner_id').notNull().references(() => users.id), status: text('status').notNull().default('pending'), totalCents: integer('total_cents').notNull(), currency: text('currency').notNull().default('CAD'), printApprovedAt: integer('print_approved_at', { mode: 'timestamp' }), createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});
export const professionalAccounts = sqliteTable('professional_accounts', {
  id: text('id').primaryKey(), ownerId: text('owner_id').notNull().references(() => users.id), organizationName: text('organization_name').notNull(), brandingJson: text('branding_json').notNull().default('{}'), creditsPurchased: integer('credits_purchased').notNull().default(0), creditsUsed: integer('credits_used').notNull().default(0), createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});
export const memoryLinks = sqliteTable('memory_links', {
  id: text('id').primaryKey(), projectId: text('project_id').notNull().unique().references(() => projects.id), ownerId: text('owner_id').notNull().references(() => users.id), slug: text('slug').notNull().unique(), accessCodeHash: text('access_code_hash'), status: text('status').notNull().default('private'), expiresAt: integer('expires_at', { mode: 'timestamp' }), createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});
export const approvals = sqliteTable('approvals', {
  id: text('id').primaryKey(), projectId: text('project_id').notNull().references(() => projects.id), ownerId: text('owner_id').notNull().references(() => users.id), versionHash: text('version_hash').notNull(), approvedAt: integer('approved_at', { mode: 'timestamp' }).notNull(), userAgent: text('user_agent'),
}, (table) => [index('idx_approvals_project_id').on(table.projectId)]);
export const bookGenerations = sqliteTable('book_generations', {
  id: text('id').primaryKey(), projectId: text('project_id').notNull().references(() => projects.id), ownerId: text('owner_id').notNull().references(() => users.id), locale: text('locale').notNull().default('fr'), status: text('status').notNull().default('ready'), model: text('model').notNull(), inputJson: text('input_json').notNull(), resultJson: text('result_json').notNull(), usageJson: text('usage_json').notNull().default('{}'), version: integer('version').notNull().default(1), createdAt: integer('created_at', { mode: 'timestamp' }).notNull(), updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, (table) => [index('idx_book_generations_project_updated').on(table.projectId, table.updatedAt), index('idx_book_generations_owner').on(table.ownerId)]);
export const messageThreads = sqliteTable('message_threads', {
  id: text('id').primaryKey(), userId: text('user_id').notNull().references(() => users.id), projectId: text('project_id').references(() => projects.id), status: text('status').notNull().default('open'), updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, (table) => [index('idx_threads_user_updated').on(table.userId, table.updatedAt)]);
export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(), threadId: text('thread_id').notNull().references(() => messageThreads.id), senderId: text('sender_id').notNull(), body: text('body').notNull(), attachmentKey: text('attachment_key'), createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
}, (table) => [index('idx_messages_thread_created').on(table.threadId, table.createdAt)]);
export const newsletterSubscribers = sqliteTable('newsletter_subscribers', {
  email: text('email').primaryKey(), locale: text('locale').notNull().default('fr'), segment: text('segment').notNull().default('owner'), status: text('status').notNull().default('subscribed'), consentSource: text('consent_source').notNull(), consentAt: integer('consent_at', { mode: 'timestamp' }).notNull(), unsubscribedAt: integer('unsubscribed_at', { mode: 'timestamp' }),
});
export const analyticsEvents = sqliteTable('analytics_events', {
  id: text('id').primaryKey(), visitorId: text('visitor_id').notNull(), eventName: text('event_name').notNull(), path: text('path').notNull(), metadataJson: text('metadata_json').notNull().default('{}'), createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
}, (table) => [index('idx_analytics_event_created').on(table.eventName, table.createdAt)]);
export const siteSettings = sqliteTable('site_settings', {
  key: text('key').primaryKey(), valueJson: text('value_json').notNull(), updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});
