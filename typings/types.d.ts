
import { BigNumber } from 'ethers/utils'

export type GasReceipt = {
  gasFee: number | string | BigNumber;
  gasLimitCallback: number | string | BigNumber;
  feeRecipient: string;
  feeTokenData: string | Uint8Array;
};

export type Opts = {
  nonce: BigNumber;
  gasReceipt?: GasReceipt | null,
  extra: Uint8Array | null;
}
