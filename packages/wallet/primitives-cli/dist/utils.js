export async function readStdin() {
    return new Promise((resolve, reject) => {
        let data = '';
        process.stdin.on('data', (chunk) => {
            data += chunk;
        });
        process.stdin.on('end', () => {
            resolve(data.trim());
        });
        process.stdin.on('error', (err) => {
            reject(err);
        });
    });
}
export async function fromPosOrStdin(argv, arg) {
    const argValue = String(argv[arg]);
    const hasArg = typeof argv[arg] === 'string' && argValue.length > 0;
    if (hasArg) {
        return argValue;
    }
    const hasStdin = !process.stdin.isTTY;
    if (!hasStdin) {
        throw new Error(`No ${String(arg)} provided and no stdin data`);
    }
    return await readStdin();
}
export function requireString(arg, name) {
    if (!arg) {
        throw new Error(`${name} is required`);
    }
}
//# sourceMappingURL=utils.js.map