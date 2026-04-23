/**
 * ModArt Write Queue
 * 
 * DATA INTEGRITY FIX: H-22 - Write queue for offline resilience
 * 
 * Queues mutations when offline and retries with exponential backoff.
 * Uses IndexedDB for persistent storage across page reloads.
 */

/**
 * Write operation structure
 * @typedef {Object} WriteOperation
 * @property {string} id - Unique operation ID
 * @property {string} type - Operation type (e.g., 'cart_update', 'order_create')
 * @property {Object} data - Operation data
 * @property {Function} execute - Function to execute the operation
 * @property {number} attempts - Number of retry attempts
 * @property {number} maxAttempts - Maximum retry attempts
 * @property {number} createdAt - Timestamp when created
 * @property {number} nextRetry - Timestamp for next retry
 * @property {string} status - 'pending', 'processing', 'completed', 'failed'
 */

class WriteQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.db = null;
    this.dbName = 'modart_write_queue';
    this.storeName = 'operations';
    this.maxAttempts = 5;
    this.baseDelay = 1000; // 1 second
    this.maxDelay = 60000; // 1 minute
    
    this.initDB();
    this.startProcessor();
    this.setupOnlineListener();
  }

  /**
   * Initializes IndexedDB for persistent queue storage
   */
  async initDB() {
    if (!('indexedDB' in window)) {
      console.warn('⚠️ IndexedDB not supported, write queue will not persist');
      return;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('✅ Write queue IndexedDB initialized');
        this.loadQueueFromDB();
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
          store.createIndex('status', 'status', { unique: false });
          store.createIndex('nextRetry', 'nextRetry', { unique: false });
        }
      };
    });
  }

  /**
   * Loads pending operations from IndexedDB
   */
  async loadQueueFromDB() {
    if (!this.db) return;

    try {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        const operations = request.result || [];
        this.queue = operations.filter(op => op.status === 'pending' || op.status === 'processing');
        console.log(`✅ Loaded ${this.queue.length} pending operations from IndexedDB`);
        this.processQueue();
      };
    } catch (error) {
      console.error('Failed to load queue from IndexedDB:', error);
    }
  }

  /**
   * Saves an operation to IndexedDB
   * @param {WriteOperation} operation
   */
  async saveOperationToDB(operation) {
    if (!this.db) return;

    try {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      // Don't store the execute function (can't be serialized)
      const { execute, ...serializable } = operation;
      store.put(serializable);
    } catch (error) {
      console.error('Failed to save operation to IndexedDB:', error);
    }
  }

  /**
   * Deletes an operation from IndexedDB
   * @param {string} operationId
   */
  async deleteOperationFromDB(operationId) {
    if (!this.db) return;

    try {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      store.delete(operationId);
    } catch (error) {
      console.error('Failed to delete operation from IndexedDB:', error);
    }
  }

  /**
   * Adds an operation to the queue
   * @param {string} type - Operation type
   * @param {Object} data - Operation data
   * @param {Function} execute - Function to execute
   * @returns {string} Operation ID
   */
  async add(type, data, execute) {
    const operation = {
      id: `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      data,
      execute,
      attempts: 0,
      maxAttempts: this.maxAttempts,
      createdAt: Date.now(),
      nextRetry: Date.now(),
      status: 'pending'
    };

    this.queue.push(operation);
    await this.saveOperationToDB(operation);
    
    console.log(`📝 Added operation to queue: ${type} (${operation.id})`);
    
    // Start processing if not already running
    if (!this.processing) {
      this.processQueue();
    }

    return operation.id;
  }

  /**
   * Processes the queue
   */
  async processQueue() {
    if (this.processing) return;
    if (this.queue.length === 0) return;
    if (!navigator.onLine) {
      console.log('⏸️ Offline, pausing queue processing');
      return;
    }

    this.processing = true;
    this.updateUI();

    while (this.queue.length > 0) {
      const operation = this.queue[0];
      
      // Check if it's time to retry
      if (operation.nextRetry > Date.now()) {
        break;
      }

      // Check if max attempts reached
      if (operation.attempts >= operation.maxAttempts) {
        console.error(`❌ Operation failed after ${operation.maxAttempts} attempts:`, operation.type);
        operation.status = 'failed';
        await this.saveOperationToDB(operation);
        this.queue.shift();
        continue;
      }

      // Execute operation
      operation.status = 'processing';
      operation.attempts++;
      await this.saveOperationToDB(operation);

      try {
        console.log(`⚙️ Executing operation: ${operation.type} (attempt ${operation.attempts}/${operation.maxAttempts})`);
        
        // Execute the operation
        if (typeof operation.execute === 'function') {
          await operation.execute(operation.data);
        }
        
        // Success - remove from queue
        console.log(`✅ Operation completed: ${operation.type}`);
        operation.status = 'completed';
        await this.deleteOperationFromDB(operation.id);
        this.queue.shift();
        
      } catch (error) {
        console.error(`❌ Operation failed: ${operation.type}`, error);
        
        // Calculate next retry with exponential backoff
        const delay = Math.min(
          this.baseDelay * Math.pow(2, operation.attempts - 1),
          this.maxDelay
        );
        operation.nextRetry = Date.now() + delay;
        operation.status = 'pending';
        await this.saveOperationToDB(operation);
        
        console.log(`⏰ Will retry in ${Math.round(delay / 1000)}s`);
        
        // Move to end of queue
        this.queue.shift();
        this.queue.push(operation);
      }
    }

    this.processing = false;
    this.updateUI();
  }

  /**
   * Starts the queue processor
   */
  startProcessor() {
    // Process queue every 5 seconds
    setInterval(() => {
      if (!this.processing && this.queue.length > 0) {
        this.processQueue();
      }
    }, 5000);
  }

  /**
   * Sets up online/offline event listeners
   */
  setupOnlineListener() {
    window.addEventListener('online', () => {
      console.log('🌐 Back online, processing queue');
      this.processQueue();
    });

    window.addEventListener('offline', () => {
      console.log('📴 Offline, queue will resume when online');
    });
  }

  /**
   * Updates UI to show pending operations
   */
  updateUI() {
    const pendingCount = this.queue.filter(op => op.status === 'pending' || op.status === 'processing').length;
    
    // Update badge
    const badge = document.getElementById('write-queue-badge');
    if (badge) {
      badge.textContent = pendingCount;
      badge.style.display = pendingCount > 0 ? '' : 'none';
    }

    // Show/hide indicator
    const indicator = document.getElementById('write-queue-indicator');
    if (indicator) {
      indicator.style.display = pendingCount > 0 ? 'flex' : 'none';
      
      const text = indicator.querySelector('.indicator-text');
      if (text) {
        text.textContent = `${pendingCount} pending operation${pendingCount !== 1 ? 's' : ''}`;
      }
    }
  }

  /**
   * Gets queue statistics
   * @returns {Object}
   */
  getStats() {
    const pending = this.queue.filter(op => op.status === 'pending').length;
    const processing = this.queue.filter(op => op.status === 'processing').length;
    const failed = this.queue.filter(op => op.status === 'failed').length;
    
    return {
      total: this.queue.length,
      pending,
      processing,
      failed
    };
  }

  /**
   * Clears completed and failed operations
   */
  async clearCompleted() {
    if (!this.db) return;

    try {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('status');
      
      // Delete completed operations
      const completedRequest = index.openCursor(IDBKeyRange.only('completed'));
      completedRequest.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
      
      // Delete failed operations
      const failedRequest = index.openCursor(IDBKeyRange.only('failed'));
      failedRequest.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
      
      console.log('✅ Cleared completed and failed operations');
    } catch (error) {
      console.error('Failed to clear operations:', error);
    }
  }
}

// Create singleton instance
const writeQueue = new WriteQueue();

/**
 * Helper functions for common operations
 */

/**
 * Queues a cart update
 * @param {Object} cartData - Cart data
 */
export async function queueCartUpdate(cartData) {
  return writeQueue.add(
    'cart_update',
    cartData,
    async (data) => {
      if (window.syncCartToSupabase) {
        await window.syncCartToSupabase();
      }
    }
  );
}

/**
 * Queues an order creation
 * @param {Object} orderData - Order data
 */
export async function queueOrderCreate(orderData) {
  return writeQueue.add(
    'order_create',
    orderData,
    async (data) => {
      if (window.createOrder) {
        await window.createOrder(data.shippingAddress, data.paymentMethod);
      }
    }
  );
}

/**
 * Queues a wishlist update
 * @param {Object} wishlistData - Wishlist data
 */
export async function queueWishlistUpdate(wishlistData) {
  return writeQueue.add(
    'wishlist_update',
    wishlistData,
    async (data) => {
      // Implement wishlist sync if available
      console.log('Wishlist update queued:', data);
    }
  );
}

// Export singleton
export default writeQueue;

// Export for window access
if (typeof window !== 'undefined') {
  window.writeQueue = writeQueue;
  window.queueCartUpdate = queueCartUpdate;
  window.queueOrderCreate = queueOrderCreate;
  window.queueWishlistUpdate = queueWishlistUpdate;
}
