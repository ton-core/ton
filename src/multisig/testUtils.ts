import { Address, CommonMessageInfoRelaxed, Cell, MessageRelaxed } from '../index'

function createCommonMessageInfoInternal (bounce: boolean, dest: Address, value: bigint): CommonMessageInfoRelaxed {
    return {
        bounce,
        bounced: false,
        createdAt: 0,
        createdLt: 0n,
        dest,
        forwardFee: 0n,
        ihrDisabled: true,
        ihrFee: 0n,
        type: 'internal',
        value: {
            coins: value
        }
    }
}

export function createInternalMessage (bounce: boolean, dest: Address, value: bigint, body: Cell, mode: number = 3): MessageRelaxed {
    return {
        info: createCommonMessageInfoInternal(bounce, dest, value),
        body
    }
}
