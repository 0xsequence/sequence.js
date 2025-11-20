import { Generic } from './generic.js';
const TABLE_NAME = 'wallets';
export class Wallets extends Generic {
    constructor(dbName = 'sequence-manager') {
        super(dbName, TABLE_NAME, 'address', [
            (db, _tx, _event) => {
                if (!db.objectStoreNames.contains(TABLE_NAME)) {
                    db.createObjectStore(TABLE_NAME);
                }
            },
        ]);
    }
}
