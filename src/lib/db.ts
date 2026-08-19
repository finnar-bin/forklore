import Dexie, { type EntityTable } from 'dexie';
import type { Profile } from '../types/profile';
import type { Group } from '../types/group';
import type { Ingredient } from '../types/ingredient';
import type { Recipe } from '../types/recipe';
import type { LogEntry } from '../types/log';
import type { OutboxItem } from '../types/sync';

// See frontend-architecture.md "Dexie schema" — source of truth when offline.
const db = new Dexie('calorie-app') as Dexie & {
  profiles: EntityTable<Profile, 'id'>;
  groups: EntityTable<Group, 'id'>;
  ingredients: EntityTable<Ingredient, 'id'>;
  recipes: EntityTable<Recipe, 'id'>;
  log_entries: EntityTable<LogEntry, 'id'>;
  outbox: EntityTable<OutboxItem, 'id'>;
};

db.version(1).stores({
  profiles: 'id',
  groups: 'id, owner_id',
  ingredients: 'id, group_id, created_by, updated_at',
  recipes: 'id, group_id, created_by, updated_at',
  log_entries: 'id, group_id, logged_by, logged_at',
  outbox: 'id, created_at',
});

export { db };
