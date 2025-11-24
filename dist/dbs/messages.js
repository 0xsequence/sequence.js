import { Generic } from './generic.js';
const TABLE_NAME = 'messages';
export class Messages extends Generic {
    constructor(dbName = 'sequence-messages') {
        super(dbName, TABLE_NAME, 'id', [
            (db, _tx, _event) => {
                if (!db.objectStoreNames.contains(TABLE_NAME)) {
                    db.createObjectStore(TABLE_NAME);
                }
            },
        ]);
    }
}
