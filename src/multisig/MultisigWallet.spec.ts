import { beginCell, Cell, ContractProvider } from 'ton-core'
import { randomTestKey } from '../utils/randomTestKey'
import { Order } from './Order'
import { ContractSystem, testAddress, Treasure } from 'ton-emulator'
import { MultisigWallet } from './MultisigWallet'
import { createInternalMessageWithMode } from './testUtils'

describe('MultisigWallet', () => {
    var publicKeys: Buffer[]
    var secretKeys: Buffer[]
    var system: ContractSystem
    var treasure: Treasure

    function createProvider (multisig: MultisigWallet): ContractProvider {
        const stateInit = multisig.formStateInit()
        return system.provider({
            address: multisig.address,
            init: {
                code: stateInit.code!,
                data: stateInit.data!
            }
        })
    }

    beforeAll(async () => {
        publicKeys = []
        secretKeys = []
        for (let i = 0; i < 10; i += 1) {
            let kp = randomTestKey(i.toString())
            publicKeys.push(kp.publicKey)
            secretKeys.push(kp.secretKey)
        }
    })

    beforeEach(async () => {
        system = await ContractSystem.create()
        treasure = await system.treasure('my-treasure')
    })

    it('should create MultisigWallet object', () => {
        let multisig = new MultisigWallet(publicKeys, 0, 123, 2)
    })

    it('should deploy via internal message', async () => {
        let multisig = new MultisigWallet(publicKeys, 0, 123, 2)
        let provider = createProvider(multisig)
        
        await multisig.deployInternal(treasure)
        let txs = await system.run()
        expect(txs).toHaveLength(2)
        expect(txs[1].endStatus).toEqual('active')
    })

    it('should load contract from address', async () => {
        let multisig = new MultisigWallet(publicKeys, 0, 123, 2)
        let provider = createProvider(multisig)
        await multisig.deployInternal(treasure)
        await system.run()

        let multisigFromProvider = await MultisigWallet.fromAddress(multisig.address, provider)
        expect(multisig.address.toRawString()).toEqual(multisigFromProvider.address.toRawString())
        expect(multisig.owners.keys().toString()).toEqual(multisigFromProvider.owners.keys().toString())
        expect(multisig.owners.values().toString()).toEqual(multisigFromProvider.owners.values().toString())
    })

    it('should find order by public key', () => {
        let multisig = new MultisigWallet(publicKeys, 0, 123, 2)
        for (let i = 0; i < publicKeys.length; i += 1) {
            expect(multisig.getOwnerIdByPubkey(publicKeys[i])).toEqual(i)
        }
    })

    it('should accept orders', async () => {
        let multisig = new MultisigWallet(publicKeys, 0, 123, 2)
        let provider = createProvider(multisig)
        await multisig.deployInternal(treasure, 10000000000n)
        await system.run()

        let order = new Order()
        order.addMessage(createInternalMessageWithMode(true, testAddress('address1'), 1000000000n, Cell.EMPTY))
        order.addMessage(createInternalMessageWithMode(true, testAddress('address2'), 0n, beginCell().storeUint(3, 123).endCell()))
        order.addMessage(createInternalMessageWithMode(true, testAddress('address1'), 2000000000n, Cell.EMPTY))

        await multisig.sendOrder(provider, order, secretKeys[3])
        let txs = await system.run()
    })

    it('should accept multiple orders and send messages', async () => {
        let multisig = new MultisigWallet(publicKeys, 0, 123, 5)
        let provider = createProvider(multisig)
        await multisig.deployInternal(treasure, 10000000000n)
        await system.run()

        let order = new Order()
        order.addMessage(createInternalMessageWithMode(false, testAddress('address1'), 1000000000n, Cell.EMPTY))
        order.addMessage(createInternalMessageWithMode(false, testAddress('address2'), 0n, beginCell().storeUint(3, 123).endCell()))
        order.addMessage(createInternalMessageWithMode(true, testAddress('address1'), 2000000000n, Cell.EMPTY))

        for (let i = 0; i < 4; i += 1) {
            await multisig.sendOrder(provider, order, secretKeys[i])
            await system.run()
        }

        await multisig.sendOrder(provider, order, secretKeys[7])
        let txs = await system.run()
        expect(txs).toHaveLength(5)
    })
})