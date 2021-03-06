export {
  isNativeMove,
  isERC20Move,
  isERC721Move,
  isERC1155Move,
  isBridgeNative,
  isBridgeERC20,
  isBridgeERC712,
  isBridgeERC1155
} from './bridges'

export type {
  Bridge,
  BridgeNative,
  BridgeERC20,
  BridgeERC721,
  BridgeERC1155,
  Move,
  MoveERC20,
  MoveERC721,
  MoveERC1155,
  MoveEstimate
} from './bridges'


export { MaticPosBridge } from './bridges/matic-bridge'

export { BridgesClient } from './client'
export type { BridgeOption } from './client'
