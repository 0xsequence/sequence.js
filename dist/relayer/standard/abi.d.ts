export declare const erc20BalanceOf: {
    readonly name: "balanceOf";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "address";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
};
export declare const erc20Allowance: {
    readonly name: "allowance";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "address";
    }, {
        readonly type: "address";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
};
export declare const erc721OwnerOf: {
    readonly name: "ownerOf";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
    }];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
};
export declare const erc721GetApproved: {
    readonly name: "getApproved";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
    }];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
};
export declare const erc1155BalanceOf: {
    readonly name: "balanceOf";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "address";
    }, {
        readonly type: "uint256";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
};
export declare const erc1155IsApprovedForAll: {
    readonly name: "isApprovedForAll";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "address";
    }, {
        readonly type: "address";
    }];
    readonly outputs: readonly [{
        readonly type: "bool";
    }];
};
//# sourceMappingURL=abi.d.ts.map