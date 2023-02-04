import { beginCell, Cell, Address, CommonMessageInfoRelaxed } from 'ton-core'
import { randomTestKey } from '../utils/randomTestKey'
import { testAddress } from '../utils/testAddress'
import { MessageWithMode } from '../utils/MessageWithMode'
import { Order } from './Order'

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

function createInternalMessageWithMode (bounce: boolean, dest: Address, value: bigint, body: Cell, mode: number = 3): MessageWithMode {
    return {
        message: {
            info: createCommonMessageInfoInternal(bounce, dest, value),
            body
        },
        mode: mode
    }
}

describe('Order', () => {
    var publicKeys: Buffer[]
    var secretKeys: Buffer[]

    beforeAll(async () => {
        publicKeys = []
        secretKeys = []
        for (let i = 0; i < 10; i += 1) {
            let kp = randomTestKey(i.toString())
            publicKeys.push(kp.publicKey)
            secretKeys.push(kp.secretKey)
        }
    })

    it('should add messages', () => {
        let order = new Order()
        order.addMessage(createInternalMessageWithMode(true, testAddress('address1'), 1000000000n, Cell.EMPTY))
        order.addMessage(createInternalMessageWithMode(true, testAddress('address2'), 0n, beginCell().storeUint(3, 123).endCell()))
        order.addMessage(createInternalMessageWithMode(true, testAddress('address1'), 2000000000n, Cell.EMPTY))
        expect(order.messages).toHaveLength(3)
    })

    it('should add signatures', () => {
        let order = new Order()
        order.addMessage(createInternalMessageWithMode(true, testAddress('address1'), 1000000000n, Cell.EMPTY))
        order.addMessage(createInternalMessageWithMode(true, testAddress('address2'), 0n, beginCell().storeUint(3, 123).endCell()))
        order.addMessage(createInternalMessageWithMode(true, testAddress('address1'), 2000000000n, Cell.EMPTY))
        order.addSignature(0, secretKeys[0])
        order.addSignature(1, secretKeys[1])
        order.addSignature(2, secretKeys[2])
        expect(order.signatures.size).toEqual(3)
    })

    it('should union signatures', () => {
        let order1 = new Order()
        order1.addMessage(createInternalMessageWithMode(true, testAddress('address1'), 1000000000n, Cell.EMPTY))
        order1.addMessage(createInternalMessageWithMode(true, testAddress('address2'), 0n, beginCell().storeUint(3, 123).endCell()))
        order1.addMessage(createInternalMessageWithMode(true, testAddress('address1'), 2000000000n, Cell.EMPTY))
        order1.addSignature(0, secretKeys[0])
        order1.addSignature(1, secretKeys[1])
        order1.addSignature(2, secretKeys[2])
        let order2 = new Order()
        order2.addMessage(createInternalMessageWithMode(true, testAddress('address1'), 1000000000n, Cell.EMPTY))
        order2.addMessage(createInternalMessageWithMode(true, testAddress('address2'), 0n, beginCell().storeUint(3, 123).endCell()))
        order2.addMessage(createInternalMessageWithMode(true, testAddress('address1'), 2000000000n, Cell.EMPTY))
        order2.addSignature(3, secretKeys[3])
        order2.addSignature(2, secretKeys[2])
        order2.addSignature(5, secretKeys[5])
        order1.unionSignatures(order2)
        expect(order1.signatures.size).toEqual(5)
    })

    it('should clear signatures', () => {
        let order = new Order()
        order.addMessage(createInternalMessageWithMode(true, testAddress('address1'), 1000000000n, Cell.EMPTY))
        order.addMessage(createInternalMessageWithMode(true, testAddress('address2'), 0n, beginCell().storeUint(3, 123).endCell()))
        order.addMessage(createInternalMessageWithMode(true, testAddress('address1'), 2000000000n, Cell.EMPTY))
        order.addSignature(0, secretKeys[0])
        order.addSignature(1, secretKeys[1])
        order.addSignature(2, secretKeys[2])
        order.clearSignatures()
        expect(order.signatures.size).toEqual(0)
    })
})