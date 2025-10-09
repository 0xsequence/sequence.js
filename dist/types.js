export class AuthRequiredError extends Error {
    id;
    constructor(id) {
        super('auth required');
        this.id = id;
        this.name = 'AuthRequiredError';
        Object.setPrototypeOf(this, AuthRequiredError.prototype);
    }
}
