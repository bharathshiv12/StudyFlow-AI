import {
  getMockFileObjectUrl,
  removeMockFiles,
  saveMockFile,
} from "@/lib/mock-file-storage";

const listeners = new Set<(event: string, session: unknown) => void>();

const TABLES_WITH_USER_ID = new Set([
  "study_tasks",
  "assignments",
  "focus_sessions",
  "quizzes",
  "daily_quotes",
  "chat_messages",
  "user_settings",
]);

export function getMockUserId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const session = JSON.parse(localStorage.getItem("mock_session") || "null");
    return session?.user?.id ?? null;
  } catch {
    return null;
  }
}

function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

type MutationType = "select" | "insert" | "update" | "delete";

class MockQueryBuilder {
  private tableName: string;
  private filters: Array<(item: Record<string, unknown>) => boolean> = [];
  private sortCol: string | null = null;
  private sortAsc = true;
  private limitNum: number | null = null;
  private mutation: MutationType = "select";
  private mutationData: unknown = null;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  private getItems(): Record<string, unknown>[] {
    if (typeof window === "undefined") return [];
    return JSON.parse(localStorage.getItem(`mock_db_${this.tableName}`) || "[]");
  }

  private saveItems(items: Record<string, unknown>[]) {
    if (typeof window === "undefined") return;
    localStorage.setItem(`mock_db_${this.tableName}`, JSON.stringify(items));
  }

  private matchesFilters(item: Record<string, unknown>) {
    return this.filters.every((filter) => filter(item));
  }

  private scopeToUser(items: Record<string, unknown>[]) {
    const userId = getMockUserId();
    if (!userId || this.mutation !== "select") return items;

    if (this.tableName === "profiles") {
      return items.filter((item) => item.id === userId);
    }
    if (!TABLES_WITH_USER_ID.has(this.tableName)) return items;
    return items.filter((item) => item.user_id === userId);
  }

  select(_columns = "*") {
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push((item) => item[column] === value);
    return this;
  }

  gte(column: string, value: unknown) {
    this.filters.push((item) => {
      if (!item[column]) return false;
      const cell = item[column];
      if (typeof cell === "string" && typeof value === "string") {
        return cell >= value || new Date(cell).getTime() >= new Date(value).getTime();
      }
      return (cell as string | number) >= (value as string | number);
    });
    return this;
  }

  lte(column: string, value: unknown) {
    this.filters.push((item) => {
      if (!item[column]) return false;
      const cell = item[column];
      if (typeof cell === "string" && typeof value === "string") {
        return cell <= value || new Date(cell).getTime() <= new Date(value).getTime();
      }
      return (cell as string | number) <= (value as string | number);
    });
    return this;
  }

  not(column: string, operator: string, value: unknown) {
    if (operator === "is" && value === null) {
      this.filters.push((item) => item[column] !== null && item[column] !== undefined);
    } else {
      this.filters.push((item) => item[column] !== value);
    }
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.sortCol = column;
    this.sortAsc = options?.ascending !== false;
    return this;
  }

  limit(n: number) {
    this.limitNum = n;
    return this;
  }

  insert(data: unknown) {
    this.mutation = "insert";
    this.mutationData = data;
    return this;
  }

  update(data: unknown) {
    this.mutation = "update";
    this.mutationData = data;
    return this;
  }

  delete() {
    this.mutation = "delete";
    return this;
  }

  private defaultsForTable(): Record<string, unknown> {
    if (this.tableName === "focus_sessions") {
      return { started_at: new Date().toISOString(), completed_minutes: 0, finished: false };
    }
    if (this.tableName === "study_tasks") {
      return { completed: false, duration_minutes: 30, task_type: "study" };
    }
    if (this.tableName === "assignments") {
      return { completed: false };
    }
    if (this.tableName === "user_settings") {
      return {
        notify_email: true,
        notify_sms: false,
        daily_quote_email: false,
        daily_quote_sms: false,
        reminder_lead_minutes: 30,
      };
    }
    return {};
  }

  private runInsert(): { data: Record<string, unknown>[]; error: null } {
    const items = this.getItems();
    const rowsToInsert = Array.isArray(this.mutationData) ? this.mutationData : [this.mutationData];
    const insertedRows: Record<string, unknown>[] = [];
    const userId = getMockUserId();

    for (const row of rowsToInsert as Record<string, unknown>[]) {
      const newRow: Record<string, unknown> = {
        id: newId(),
        created_at: new Date().toISOString(),
        ...this.defaultsForTable(),
        ...row,
      };
      if (userId && TABLES_WITH_USER_ID.has(this.tableName) && !newRow.user_id) {
        newRow.user_id = userId;
      }
      items.push(newRow);
      insertedRows.push(newRow);
    }

    this.saveItems(items);
    return { data: insertedRows, error: null };
  }

  private runUpdate(): { data: Record<string, unknown>[]; error: null } {
    const items = this.getItems();
    const updatedRows: Record<string, unknown>[] = [];
    const patch = this.mutationData as Record<string, unknown>;

    const newItems = items.map((item) => {
      if (!this.matchesFilters(item)) return item;
      const updated = { ...item, ...patch, updated_at: new Date().toISOString() };
      updatedRows.push(updated);
      return updated;
    });

    if (updatedRows.length === 0 && this.tableName === "user_settings" && getMockUserId()) {
      const userId = getMockUserId()!;
      const row = {
        user_id: userId,
        created_at: new Date().toISOString(),
        ...this.defaultsForTable(),
        ...patch,
        updated_at: new Date().toISOString(),
      };
      newItems.push(row);
      updatedRows.push(row);
    }

    if (updatedRows.length === 0 && this.tableName === "profiles" && getMockUserId()) {
      const userId = getMockUserId()!;
      const row = {
        id: userId,
        created_at: new Date().toISOString(),
        ...patch,
        updated_at: new Date().toISOString(),
      };
      newItems.push(row);
      updatedRows.push(row);
    }

    this.saveItems(newItems);
    return { data: updatedRows, error: null };
  }

  private runDelete(): { data: Record<string, unknown>[]; error: null } {
    const items = this.getItems();
    const deletedRows: Record<string, unknown>[] = [];
    const remaining = items.filter((item) => {
      if (this.matchesFilters(item)) {
        deletedRows.push(item);
        return false;
      }
      return true;
    });
    this.saveItems(remaining);
    return { data: deletedRows, error: null };
  }

  private runSelect(): { data: Record<string, unknown>[]; error: null } {
    let items = this.scopeToUser(this.getItems());

    for (const filter of this.filters) {
      items = items.filter(filter);
    }

    if (this.sortCol) {
      const col = this.sortCol;
      items.sort((a, b) => {
        const valA = a[col];
        const valB = b[col];
        if (valA === valB) return 0;
        if (valA === null || valA === undefined) return 1;
        if (valB === null || valB === undefined) return -1;
        if (typeof valA === "string" && typeof valB === "string") {
          return this.sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return this.sortAsc ? (valA > valB ? 1 : -1) : valB > valA ? 1 : -1;
      });
    }

    if (this.limitNum !== null) {
      items = items.slice(0, this.limitNum);
    }

    return { data: items, error: null };
  }

  private execute(): { data: Record<string, unknown>[] | null; error: unknown } {
    try {
      if (this.mutation === "insert") return this.runInsert();
      if (this.mutation === "update") return this.runUpdate();
      if (this.mutation === "delete") return this.runDelete();
      return this.runSelect();
    } catch (error) {
      return { data: null, error };
    }
  }

  then<TResult1 = { data: unknown; error: unknown }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: unknown }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }

  async single() {
    const { data, error } = this.execute();
    if (error) return { data: null, error };
    if (!data || data.length === 0) {
      return { data: null, error: { message: "No rows found" } };
    }
    return { data: data[0], error: null };
  }

  async maybeSingle() {
    const { data, error } = this.execute();
    if (error) return { data: null, error };
    if (!data || data.length === 0) {
      return { data: null, error: null };
    }
    return { data: data[0], error: null };
  }
}

const mockAuth = {
  async getSession() {
    if (typeof window === "undefined") return { data: { session: null }, error: null };
    const saved = localStorage.getItem("mock_session");
    const session = saved ? JSON.parse(saved) : null;
    return { data: { session }, error: null };
  },

  onAuthStateChange(callback: (event: string, session: unknown) => void) {
    listeners.add(callback);
    void this.getSession().then(({ data }) => {
      callback("INITIAL_SESSION", data.session);
    });
    return {
      data: {
        subscription: {
          unsubscribe() {
            listeners.delete(callback);
          },
        },
      },
    };
  },

  async signUp({ email, password, options }: { email: string; password: string; options?: { data?: { full_name?: string } } }) {
    if (typeof window === "undefined") throw new Error("Browser only");
    const users = JSON.parse(localStorage.getItem("mock_users") || "[]") as Array<{
      id: string;
      email: string;
      password: string;
      full_name: string;
    }>;
    if (users.some((u) => u.email === email)) {
      return { data: { user: null, session: null }, error: { message: "User already exists" } };
    }

    const userId = newId();
    const fullName = options?.data?.full_name || email.split("@")[0];
    users.push({ id: userId, email, password, full_name: fullName });
    localStorage.setItem("mock_users", JSON.stringify(users));

    const profiles = JSON.parse(localStorage.getItem("mock_db_profiles") || "[]");
    profiles.push({
      id: userId,
      email,
      full_name: fullName,
      phone: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    localStorage.setItem("mock_db_profiles", JSON.stringify(profiles));

    const settings = JSON.parse(localStorage.getItem("mock_db_user_settings") || "[]");
    settings.push({
      user_id: userId,
      notify_email: true,
      notify_sms: false,
      daily_quote_email: false,
      daily_quote_sms: false,
      reminder_lead_minutes: 30,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    localStorage.setItem("mock_db_user_settings", JSON.stringify(settings));

    const session = {
      access_token: `mock-token-${userId}`,
      user: { id: userId, email, user_metadata: { full_name: fullName } },
    };
    localStorage.setItem("mock_session", JSON.stringify(session));
    listeners.forEach((l) => l("SIGNED_IN", session));

    return { data: { user: session.user, session }, error: null };
  },

  async signInWithPassword({ email, password }: { email: string; password: string }) {
    if (typeof window === "undefined") throw new Error("Browser only");
    const users = JSON.parse(localStorage.getItem("mock_users") || "[]") as Array<{
      id: string;
      email: string;
      password: string;
      full_name: string;
    }>;

    const user = users.find((u) => u.email === email && u.password === password);
    if (!user) {
      return { data: { user: null, session: null }, error: { message: "Invalid login credentials" } };
    }

    const session = {
      access_token: `mock-token-${user.id}`,
      user: { id: user.id, email: user.email, user_metadata: { full_name: user.full_name } },
    };
    localStorage.setItem("mock_session", JSON.stringify(session));
    listeners.forEach((l) => l("SIGNED_IN", session));

    return { data: { user: session.user, session }, error: null };
  },

  async signOut() {
    if (typeof window === "undefined") return { error: null };
    localStorage.removeItem("mock_session");
    listeners.forEach((l) => l("SIGNED_OUT", null));
    return { error: null };
  },

  async getClaims(token: string) {
    const userId = token.replace("mock-token-", "");
    return {
      data: {
        claims: {
          sub: userId,
          email: "mock@example.com",
        },
      },
      error: null,
    };
  },
};

const mockStorage = {
  from(bucketName: string) {
    return {
      async upload(path: string, file: File) {
        if (typeof window === "undefined") {
          return { data: null, error: new Error("Browser only") };
        }
        try {
          await saveMockFile(bucketName, path, file);
          return { data: { path }, error: null };
        } catch (error) {
          return { data: null, error: error as Error };
        }
      },

      async createSignedUrl(path: string, _expiry: number) {
        if (typeof window === "undefined") {
          return { data: null, error: new Error("Browser only") };
        }
        const signedUrl = await getMockFileObjectUrl(bucketName, path);
        if (!signedUrl) {
          return { data: null, error: new Error("File not found") };
        }
        return { data: { signedUrl }, error: null };
      },

      async remove(paths: string[]) {
        if (typeof window === "undefined") {
          return { data: null, error: new Error("Browser only") };
        }
        try {
          await removeMockFiles(bucketName, paths);
          return { data: paths, error: null };
        } catch (error) {
          return { data: null, error: error as Error };
        }
      },
    };
  },
};

export const mockSupabaseClient = {
  auth: mockAuth,
  from(tableName: string) {
    return new MockQueryBuilder(tableName);
  },
  storage: mockStorage,
};
