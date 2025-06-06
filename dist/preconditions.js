export function findPreconditionAddress(preconditions) {
    console.log('Finding precondition address from:', JSON.stringify(preconditions, null, 2));
    const preconditionTypes = ['erc20-balance', 'native-balance'];
    for (const type of preconditionTypes) {
        const precondition = preconditions.find((p) => p.type === type && p.data?.address);
        if (precondition) {
            console.log(`Found ${type} precondition with address:`, precondition.data.address);
            return precondition.data.address;
        }
    }
    const msg = `N/A (No ${preconditionTypes.join(' or ')} precondition with address found)`;
    console.log(msg);
    return msg;
}
