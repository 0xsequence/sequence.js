import { Generic } from './generic.js';
const TABLE_NAME = 'transactions';
export class Transactions extends Generic {
    constructor(dbName = 'sequence-transactions') {
        super(dbName, TABLE_NAME, 'id', [
            (db, _tx, _event) => {
                if (!db.objectStoreNames.contains(TABLE_NAME)) {
                    db.createObjectStore(TABLE_NAME);
                }
            },
        ]);
    }
}
