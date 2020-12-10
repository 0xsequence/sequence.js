import { WindowMessageProvider } from '@0xsequence/provider'

export const Sawp = () => {
  const wallet = new WindowMessageProvider('https://hi.com')
  // wallet.login()
  console.log('dfdf', wallet)

  return 123
}

export const Huh = 123

export { WindowMessageProvider }

export const Wee = async () => {
  const v = await yes()
  return v
}

const yes = (): Promise<number> => {
  return new Promise(resolve => {
    resolve(5)
  })
}

export const sequence = {

}
