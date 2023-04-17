import { Tenderly, TenderlyConfiguration, VerificationRequest } from '@tenderly/sdk'
import { ethers } from 'ethers'
import { createLogger, Logger } from '../utils/logger'

let prompt: Logger
createLogger().then(logger => (prompt = logger))

ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.OFF)

export class TenderlyVerifier {

  private readonly tenderly: Tenderly

  constructor(tenderlyConfig: Tenderly | TenderlyConfiguration) {
    this.tenderly = tenderlyConfig instanceof Tenderly ? tenderlyConfig : new Tenderly(tenderlyConfig)
  }

  verifyContract = async (
    address: string,
    contractAlias: string,
    tenderVerificationRequest: VerificationRequest
  ): Promise<void> => {
    const addr = address.toLowerCase()

    await this.tenderly.contracts.add(addr, { displayName: contractAlias })
    await this.tenderly.contracts.verify(addr, tenderVerificationRequest)
  }

}
