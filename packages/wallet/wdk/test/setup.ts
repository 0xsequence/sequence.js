import { indexedDB } from 'fake-indexeddb'
import { IDBFactory } from 'fake-indexeddb'

// Add IndexedDB support to the test environment
global.indexedDB = indexedDB
global.IDBFactory = IDBFactory
