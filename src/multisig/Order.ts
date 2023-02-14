import { sign } from 'ton-crypto'
import { beginCell, Builder, MessageRelaxed, storeMessageRelaxed } from 'ton-core'

export class Order {
    public messages: Builder = beginCell()
    public signatures: { [key: number]: Buffer } = {}
    public queryId: bigint = 0n
    private walletId: number
    private queryOffset: number

    constructor (walletId: number, offset?: number) {
        this.walletId = walletId
        this.queryOffset = offset || 7200
    }

    public addMessage (message: MessageRelaxed, mode: number) {
        if (this.messages.refs >= 4) throw('only 4 refs are allowed')
        this.clearSignatures()
        this.updateQueryId()
        this.messages.storeUint(mode, 8)
        this.messages.storeRef(beginCell().store(storeMessageRelaxed(message)).endCell())
    }

    public addSignature (ownerId: number, secretKey: Buffer) {
        const signingHash = beginCell()
            .storeUint(this.walletId, 32)
            .storeUint(this.queryId, 64)
            .storeBuilder(this.messages)
        .endCell().hash()

        this.signatures[ownerId] = sign(signingHash, secretKey)
    }

    public unionSignatures (other: Order) {
        this.signatures = Object.assign({}, this.signatures, other.signatures)
    }

    public clearMessages () {
        this.messages = beginCell()
        this.clearSignatures()
    }

    public clearSignatures () {
        this.signatures = {}
    }

    private updateQueryId () {
        const time = BigInt(Math.floor(Date.now() / 1000 + this.queryOffset))
        this.queryId = time << 32n
    }
}
