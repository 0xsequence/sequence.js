export declare const ZeroAddress: "0x0000000000000000000000000000000000000000";
export declare const PlaceholderAddress: "0xffff0000ffff0000ffff0000ffff0000ffff0000";
export declare const DefaultGuestAddress: "0x0000000000601fcA38f0cCA649453F6739436d6C";
export declare const IS_VALID_SIGNATURE: {
    readonly name: "isValidSignature";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "_hash";
    }, {
        readonly type: "bytes";
        readonly name: "_signature";
    }];
    readonly outputs: readonly [{
        readonly type: "bytes4";
        readonly name: "magicValue";
    }];
};
export declare const DEPLOY: {
    readonly name: "deploy";
    readonly type: "function";
    readonly stateMutability: "payable";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "_mainModule";
    }, {
        readonly type: "bytes32";
        readonly name: "_salt";
    }];
    readonly outputs: readonly [{
        readonly type: "address";
        readonly name: "_contract";
    }];
};
export declare const GET_IMPLEMENTATION: {
    readonly name: "getImplementation";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
};
export declare const IMAGE_HASH: {
    readonly name: "imageHash";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "bytes32";
    }];
};
export declare const READ_NONCE: {
    readonly name: "readNonce";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "_space";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
};
export declare const EXECUTE: {
    readonly name: "execute";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "bytes";
        readonly name: "_payload";
    }, {
        readonly type: "bytes";
        readonly name: "_signature";
    }];
    readonly outputs: readonly [];
};
export declare const UPDATE_IMAGE_HASH: {
    readonly name: "updateImageHash";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "_imageHash";
    }];
    readonly outputs: readonly [];
};
export declare const RECOVER_SAPIENT_SIGNATURE: {
    readonly name: "recoverSapientSignature";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint8";
            readonly name: "kind";
        }, {
            readonly type: "bool";
            readonly name: "noChainId";
        }, {
            readonly type: "tuple[]";
            readonly components: readonly [{
                readonly type: "address";
                readonly name: "to";
            }, {
                readonly type: "uint256";
                readonly name: "value";
            }, {
                readonly type: "bytes";
                readonly name: "data";
            }, {
                readonly type: "uint256";
                readonly name: "gasLimit";
            }, {
                readonly type: "bool";
                readonly name: "delegateCall";
            }, {
                readonly type: "bool";
                readonly name: "onlyFallback";
            }, {
                readonly type: "uint256";
                readonly name: "behaviorOnError";
            }];
            readonly name: "calls";
        }, {
            readonly type: "uint256";
            readonly name: "space";
        }, {
            readonly type: "uint256";
            readonly name: "nonce";
        }, {
            readonly type: "bytes";
            readonly name: "message";
        }, {
            readonly type: "bytes32";
            readonly name: "imageHash";
        }, {
            readonly type: "bytes32";
            readonly name: "digest";
        }, {
            readonly type: "address[]";
            readonly name: "parentWallets";
        }];
        readonly name: "_payload";
    }, {
        readonly type: "bytes";
        readonly name: "_signature";
    }];
    readonly outputs: readonly [{
        readonly type: "bytes32";
    }];
};
export declare const RECOVER_SAPIENT_SIGNATURE_COMPACT: {
    readonly name: "recoverSapientSignatureCompact";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "_digest";
    }, {
        readonly type: "bytes";
        readonly name: "_signature";
    }];
    readonly outputs: readonly [{
        readonly type: "bytes32";
    }];
};
export declare const EXECUTE_USER_OP: {
    readonly name: "executeUserOp";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "bytes";
        readonly name: "_userOp";
    }];
    readonly outputs: readonly [];
};
export declare const READ_NONCE_4337: {
    readonly name: "getNonce";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "_account";
    }, {
        readonly type: "uint192";
        readonly name: "_key";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
};
export declare const READ_ENTRYPOINT: {
    readonly name: "entrypoint";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
};
export declare const INCREMENT_USAGE_LIMIT: {
    readonly type: "function";
    readonly name: "incrementUsageLimit";
    readonly inputs: readonly [{
        readonly name: "limits";
        readonly type: "tuple[]";
        readonly internalType: "struct UsageLimit[]";
        readonly components: readonly [{
            readonly name: "usageHash";
            readonly type: "bytes32";
            readonly internalType: "bytes32";
        }, {
            readonly name: "usageAmount";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }];
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
};
export declare const GET_LIMIT_USAGE: {
    readonly name: "getLimitUsage";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "wallet";
    }, {
        readonly type: "bytes32";
        readonly name: "usageHash";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
};
//# sourceMappingURL=constants.d.ts.map