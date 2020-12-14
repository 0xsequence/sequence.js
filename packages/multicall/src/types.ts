
import { AuxTransactionRequest, ArcadeumTransaction } from '@arcadeum/provider'
import { FunctionFragment, ParamType } from "@ethersproject/abi";

export type Call<T> = () => Promise<T>

export type CallResult<T> = {
  call: Call<T>,
  success: boolean,
  result: Array<number>,
  outputs?: Array<T>
}
