// urlClean removes double slashes from url path
export const urlClean = (url: string) => url.replace(/([^:]\/)\/+/g, '$1')
