export const RequestActionType = {
    CREATE_NEW_SESSION: 'createNewSession',
    ADD_EXPLICIT_SESSION: 'addExplicitSession',
    MODIFY_EXPLICIT_SESSION: 'modifyExplicitSession',
    SIGN_MESSAGE: 'signMessage',
    SIGN_TYPED_DATA: 'signTypedData',
    SEND_WALLET_TRANSACTION: 'sendWalletTransaction',
};
export var MessageType;
(function (MessageType) {
    MessageType["WALLET_OPENED"] = "WALLET_OPENED";
    MessageType["INIT"] = "INIT";
    MessageType["REQUEST"] = "REQUEST";
    MessageType["RESPONSE"] = "RESPONSE";
})(MessageType || (MessageType = {}));
export var TransportMode;
(function (TransportMode) {
    TransportMode["POPUP"] = "popup";
    TransportMode["REDIRECT"] = "redirect";
})(TransportMode || (TransportMode = {}));
export const WalletSize = {
    width: 380,
    height: 600,
};
