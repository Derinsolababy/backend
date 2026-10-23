import { getDb } from '@/utils/database';
import { newId } from '@/utils/helpers';

export const ROLES = ['admin', 'manager', 'cashier'] as const;
export type Role = (typeof ROLES)[number];

interface UserRow {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: Role;
  created_at: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  createdAt: string;
}

export type PublicUser = Omit<User, 'passwordHash'>;

const toUser = (r: UserRow): User => ({
  id: r.id,
  name: r.name,
  email: r.email,
  passwordHash: r.password_hash,
  role: r.role,
  createdAt: r.created_at,
});

export const toPublicUser = ({ passwordHash: _omit, ...rest }: User): PublicUser => rest;

export const UserModel = {
  create(input: { name: string; email: string; passwordHash: string; role: Role }): User {
    const id = newId();
    getDb()
      .prepare('INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)')
      .run(id, input.name, input.email.toLowerCase(), input.passwordHash, input.role);
    return this.findById(id)!;
  },

  findById(id: string): User | undefined {
    const row = getDb().prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
    return row && toUser(row);
  },

  findByEmail(email: string): User | undefined {
    const row = getDb().prepare('SELECT * FROM users WHERE email = ?').get(email) as
      UserRow | undefined;
    return row && toUser(row);
  },

  list(): PublicUser[] {
    const rows = getDb()
      .prepare('SELECT * FROM users ORDER BY created_at')
      .all() as unknown as UserRow[];
    return rows.map((r) => toPublicUser(toUser(r)));
  },

  count(): number {
    return (getDb().prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n;
  },

  updateRole(id: string, role: Role): void {
    getDb().prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);
  },

  updateProfile(id: string, fields: { name?: string; passwordHash?: string }): void {
    if (fields.name !== undefined) {
      getDb().prepare('UPDATE users SET name = ? WHERE id = ?').run(fields.name, id);
    }
    if (fields.passwordHash !== undefined) {
      getDb()
        .prepare('UPDATE users SET password_hash = ? WHERE id = ?')
        .run(fields.passwordHash, id);
    }
  },
};
