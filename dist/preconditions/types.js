export class NativeBalancePrecondition {
    address;
    min;
    max;
    constructor(address, min, max) {
        this.address = address;
        this.min = min;
        this.max = max;
    }
    type() {
        return 'native-balance';
    }
    isValid() {
        if (!this.address) {
            return new Error('address is required');
        }
        if (this.min !== undefined && this.max !== undefined && this.min > this.max) {
            return new Error('min balance cannot be greater than max balance');
        }
        return undefined;
    }
}
export class Erc20BalancePrecondition {
    address;
    token;
    min;
    max;
    constructor(address, token, min, max) {
        this.address = address;
        this.token = token;
        this.min = min;
        this.max = max;
    }
    type() {
        return 'erc20-balance';
    }
    isValid() {
        if (!this.address) {
            return new Error('address is required');
        }
        if (!this.token) {
            return new Error('token address is required');
        }
        if (this.min !== undefined && this.max !== undefined && this.min > this.max) {
            return new Error('min balance cannot be greater than max balance');
        }
        return undefined;
    }
}
export class Erc20ApprovalPrecondition {
    address;
    token;
    operator;
    min;
    constructor(address, token, operator, min) {
        this.address = address;
        this.token = token;
        this.operator = operator;
        this.min = min;
    }
    type() {
        return 'erc20-approval';
    }
    isValid() {
        if (!this.address) {
            return new Error('address is required');
        }
        if (!this.token) {
            return new Error('token address is required');
        }
        if (!this.operator) {
            return new Error('operator address is required');
        }
        if (this.min === undefined) {
            return new Error('min approval amount is required');
        }
        return undefined;
    }
}
export class Erc721OwnershipPrecondition {
    address;
    token;
    tokenId;
    owned;
    constructor(address, token, tokenId, owned) {
        this.address = address;
        this.token = token;
        this.tokenId = tokenId;
        this.owned = owned;
    }
    type() {
        return 'erc721-ownership';
    }
    isValid() {
        if (!this.address) {
            return new Error('address is required');
        }
        if (!this.token) {
            return new Error('token address is required');
        }
        if (this.tokenId === undefined) {
            return new Error('tokenId is required');
        }
        return undefined;
    }
}
export class Erc721ApprovalPrecondition {
    address;
    token;
    tokenId;
    operator;
    constructor(address, token, tokenId, operator) {
        this.address = address;
        this.token = token;
        this.tokenId = tokenId;
        this.operator = operator;
    }
    type() {
        return 'erc721-approval';
    }
    isValid() {
        if (!this.address) {
            return new Error('address is required');
        }
        if (!this.token) {
            return new Error('token address is required');
        }
        if (this.tokenId === undefined) {
            return new Error('tokenId is required');
        }
        if (!this.operator) {
            return new Error('operator address is required');
        }
        return undefined;
    }
}
export class Erc1155BalancePrecondition {
    address;
    token;
    tokenId;
    min;
    max;
    constructor(address, token, tokenId, min, max) {
        this.address = address;
        this.token = token;
        this.tokenId = tokenId;
        this.min = min;
        this.max = max;
    }
    type() {
        return 'erc1155-balance';
    }
    isValid() {
        if (!this.address) {
            return new Error('address is required');
        }
        if (!this.token) {
            return new Error('token address is required');
        }
        if (this.tokenId === undefined) {
            return new Error('tokenId is required');
        }
        if (this.min !== undefined && this.max !== undefined && this.min > this.max) {
            return new Error('min balance cannot be greater than max balance');
        }
        return undefined;
    }
}
export class Erc1155ApprovalPrecondition {
    address;
    token;
    tokenId;
    operator;
    min;
    constructor(address, token, tokenId, operator, min) {
        this.address = address;
        this.token = token;
        this.tokenId = tokenId;
        this.operator = operator;
        this.min = min;
    }
    type() {
        return 'erc1155-approval';
    }
    isValid() {
        if (!this.address) {
            return new Error('address is required');
        }
        if (!this.token) {
            return new Error('token address is required');
        }
        if (this.tokenId === undefined) {
            return new Error('tokenId is required');
        }
        if (!this.operator) {
            return new Error('operator address is required');
        }
        if (this.min === undefined) {
            return new Error('min approval amount is required');
        }
        return undefined;
    }
}
