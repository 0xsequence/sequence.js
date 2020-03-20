
import { BigNumber } from 'ethers/utils'

export type GasReceipt = {
  gasFee: number | string | BigNumber;
  gasLimitCallback: number | string | BigNumber;
  feeRecipient: string;
  feeTokenData: FeeTokenData;
};

export enum FeeTokenType {
  FeeTokenERC1155 = 0,
  FeeTokenERC20,
}

export type FeeTokenData = {
  type: FeeTokenType,
  address: string
  id: number | BigNumber;
};

export type Opts = {
  nonce: BigNumber;
  gasReceipt?: GasReceipt | null,
  extra: Uint8Array | null;
}
