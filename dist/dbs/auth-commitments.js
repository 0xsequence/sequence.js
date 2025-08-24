import { Generic } from './generic.js';
const TABLE_NAME = 'auth-commitments';
export class AuthCommitments extends Generic {
    constructor(dbName = 'sequence-auth-commitments') {
        super(dbName, TABLE_NAME, 'id', [
            (db, _tx, _event) => {
                if (!db.objectStoreNames.contains(TABLE_NAME)) {
                    db.createObjectStore(TABLE_NAME);
                }
            },
        ]);
    }
}
