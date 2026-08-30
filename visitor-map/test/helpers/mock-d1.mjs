export class MockD1 {
  constructor({ aggregateRows = [], budgetResults = [{ accepted: 1 }], fail = null } = {}) {
    this.aggregateRows = aggregateRows;
    this.budgetResults = [...budgetResults];
    this.fail = fail;
    this.calls = [];
    this.batches = [];
  }

  prepare(sql) {
    return new MockStatement(this, sql);
  }

  async batch(statements) {
    if (this.fail === "batch") throw new Error("mock batch failure");
    this.batches.push(statements.map((statement) => ({ sql: statement.sql, binds: statement.binds })));
    return statements.map(() => ({ success: true }));
  }
}

class MockStatement {
  constructor(database, sql) {
    this.database = database;
    this.sql = sql;
    this.binds = [];
  }

  bind(...values) {
    this.binds = values;
    return this;
  }

  async first() {
    if (this.database.fail === "first") throw new Error("mock first failure");
    this.database.calls.push({ operation: "first", sql: this.sql, binds: this.binds });
    return this.database.budgetResults.length ? this.database.budgetResults.shift() : null;
  }

  async run() {
    if (this.database.fail === "run") throw new Error("mock run failure");
    this.database.calls.push({ operation: "run", sql: this.sql, binds: this.binds });
    return { success: true, meta: { changes: 1 } };
  }

  async all() {
    if (this.database.fail === "all") throw new Error("mock all failure");
    this.database.calls.push({ operation: "all", sql: this.sql, binds: this.binds });
    return { success: true, results: this.database.aggregateRows };
  }
}

export function executionContext() {
  const tasks = [];
  return {
    tasks,
    waitUntil(task) {
      tasks.push(Promise.resolve(task));
    },
    async drain() {
      await Promise.all(tasks);
    },
  };
}

export function imageRequest(
  pathname,
  {
    method = "GET",
    origin = "https://groklab.github.io",
    destination = "image",
    mode = "cors",
    site = "cross-site",
    latitude = "41.8",
    longitude = "-87.6",
    extraHeaders = {},
  } = {},
) {
  const headers = new Headers({
    Origin: origin,
    "Sec-Fetch-Dest": destination,
    "Sec-Fetch-Mode": mode,
    "Sec-Fetch-Site": site,
    ...extraHeaders,
  });
  const request = new Request(`https://map.example${pathname}`, { method, headers });
  Object.defineProperty(request, "cf", {
    value: { latitude, longitude },
    configurable: true,
  });
  return request;
}
