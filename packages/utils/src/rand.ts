export const getRandomInt = (min: number = 0, max: number = Number.MAX_SAFE_INTEGER): number => {
  min = Math.ceil(min)
  max = Math.floor(max)
  return Math.floor(Math.random() * (max - min + 1)) + min
}
