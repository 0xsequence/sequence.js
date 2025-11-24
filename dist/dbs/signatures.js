import { Generic } from './generic.js';
const TABLE_NAME = 'envelopes';
export class Signatures extends Generic {
    constructor(dbName = 'sequence-signature-requests') {
        super(dbName, TABLE_NAME, 'id', [
            (db, _tx, _event) => {
                if (!db.objectStoreNames.contains(TABLE_NAME)) {
                    db.createObjectStore(TABLE_NAME);
                }
            },
        ]);
    }
}
