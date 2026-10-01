(function () {
  const DB_NAME = 'swapnil-workout-dashboard';
  const DB_VERSION = 1;
  const STORES = ['workoutSessions', 'setLogs', 'weightLogs', 'settings', 'customSounds', 'syncQueue'];

  let dbPromise;

  function openDb() {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = event => {
        const db = event.target.result;

        if (!db.objectStoreNames.contains('workoutSessions')) {
          const store = db.createObjectStore('workoutSessions', { keyPath: 'id' });
          store.createIndex('workoutDay', 'workoutDay');
          store.createIndex('startedAt', 'startedAt');
          store.createIndex('status', 'status');
          store.createIndex('syncStatus', 'syncStatus');
        }

        if (!db.objectStoreNames.contains('setLogs')) {
          const store = db.createObjectStore('setLogs', { keyPath: 'id' });
          store.createIndex('sessionId', 'sessionId');
          store.createIndex('exerciseId', 'exerciseId');
          store.createIndex('workoutDay', 'workoutDay');
          store.createIndex('completedAt', 'completedAt');
          store.createIndex('syncStatus', 'syncStatus');
        }

        if (!db.objectStoreNames.contains('weightLogs')) {
          const store = db.createObjectStore('weightLogs', { keyPath: 'id' });
          store.createIndex('recordedAt', 'recordedAt');
          store.createIndex('syncStatus', 'syncStatus');
        }

        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }

        if (!db.objectStoreNames.contains('customSounds')) {
          db.createObjectStore('customSounds', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('syncQueue')) {
          const store = db.createObjectStore('syncQueue', { keyPath: 'id' });
          store.createIndex('status', 'status');
          store.createIndex('createdAt', 'createdAt');
          store.createIndex('storeName', 'storeName');
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return dbPromise;
  }

  async function storeOperation(storeName, mode, callback) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, mode);
      const store = transaction.objectStore(storeName);
      let result;

      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);

      result = callback(store);
    });
  }

  function promisifyRequest(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function getAll(storeName) {
    return storeOperation(storeName, 'readonly', store => promisifyRequest(store.getAll()));
  }

  async function get(storeName, id) {
    return storeOperation(storeName, 'readonly', store => promisifyRequest(store.get(id)));
  }

  async function put(storeName, record) {
    return storeOperation(storeName, 'readwrite', store => {
      store.put(record);
      return record;
    });
  }

  async function remove(storeName, id) {
    return storeOperation(storeName, 'readwrite', store => {
      store.delete(id);
      return id;
    });
  }

  async function clear(storeName) {
    return storeOperation(storeName, 'readwrite', store => {
      store.clear();
      return true;
    });
  }

  async function getByIndex(storeName, indexName, value) {
    return storeOperation(storeName, 'readonly', store => promisifyRequest(store.index(indexName).getAll(value)));
  }

  async function getRangeByIndex(storeName, indexName, range) {
    return storeOperation(storeName, 'readonly', store => promisifyRequest(store.index(indexName).getAll(range)));
  }

  async function exportAll() {
    const data = {};
    for (const storeName of STORES) data[storeName] = await getAll(storeName);
    data.exportedAt = new Date().toISOString();
    data.schemaVersion = DB_VERSION;
    return data;
  }

  async function importAll(data) {
    const allowed = STORES.filter(storeName => Array.isArray(data[storeName]));
    const db = await openDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(allowed, 'readwrite');
      transaction.oncomplete = () => resolve(true);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);

      for (const storeName of allowed) {
        const store = transaction.objectStore(storeName);
        data[storeName].forEach(record => store.put(record));
      }
    });
  }

  async function clearAll() {
    for (const storeName of STORES) await clear(storeName);
    return true;
  }

  window.WorkoutDB = {
    DB_NAME,
    DB_VERSION,
    STORES,
    openDb,
    getAll,
    get,
    put,
    remove,
    clear,
    getByIndex,
    getRangeByIndex,
    exportAll,
    importAll,
    clearAll
  };
})();
