import { Generic } from './generic.js';
const TABLE_NAME = 'queued-recovery-payloads';
export class Recovery extends Generic {
    constructor(dbName = 'sequence-recovery') {
        super(dbName, TABLE_NAME, 'id', [
            (db) => {
                if (!db.objectStoreNames.contains(TABLE_NAME)) {
                    db.createObjectStore(TABLE_NAME);
                }
            },
        ]);
    }
}
