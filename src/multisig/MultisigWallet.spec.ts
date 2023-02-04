import { Address, beginCell, Cell, ContractProvider } from 'ton-core'
import { randomTestKey } from '../utils/randomTestKey'
import { Order } from './Order'
import { ContractSystem, testAddress, Treasure } from 'ton-emulator'
import { MultisigWallet } from './MultisigWallet'
import { createInternalMessageWithMode } from './testUtils'
import { createTestClient } from '../utils/createTestClient'

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

        let multisigFromProvider = await MultisigWallet.fromAddress(multisig.address, { provider })
        expect(multisig.address.toRawString()).toEqual(multisigFromProvider.address.toRawString())
        expect(multisig.owners.keys().toString()).toEqual(multisigFromProvider.owners.keys().toString())
        expect(multisig.owners.values().toString()).toEqual(multisigFromProvider.owners.values().toString())

        const testMultisigAddress = Address.parse('EQADBXugwmn4YvWsQizHdWGgfCTN_s3qFP0Ae0pzkU-jwzoE')
        let multisigFromClient = await MultisigWallet.fromAddress(testMultisigAddress, { client: createTestClient('mainnet') })
        expect(testMultisigAddress.toRawString()).toEqual(multisigFromClient.address.toRawString())
        expect(multisigFromClient.owners.keys().toString()).toEqual('0,1,2')
        expect(multisigFromClient.owners.values().toString()).toEqual([
            Buffer.from('51ce50ebcced0fdcc7520a2cacf653c81fb49f34f9c570a9e1bb23c7f7186d8d00', 'hex'),
            Buffer.from('f7a92e5a7b97b81fdc366c4c77298cfd1e9b97ba04feecf0c1d85d63d16d9f2000', 'hex'),
            Buffer.from('6ec29f8fd53761b94291d5801cda5d0d00c48d78dc6c147ec4c6e088c3d93d8400', 'hex')
        ].toString())
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