import { sign } from 'ton-crypto'
import { MessageWithMode } from '../utils/MessageWithMode'
import { beginCell, Builder, Cell, Dictionary, storeMessageRelaxed } from 'ton-core'

export class Order {
    public messages: MessageWithMode[]
    public signatures: Dictionary<number, Buffer>
    public messagesCell: Cell
    private queryOffset: number

    constructor (offset?: number) {
        this.messages = []
        this.signatures = Dictionary.empty()
        this.queryOffset = offset || 7200
        this.messagesCell = Cell.EMPTY
    }

    public addMessage (message: MessageWithMode) {
        this.clearSignatures()
        this.messages.push(message)
        let b: Builder = beginCell().storeUint(this.getQuerryId(), 64)
        for (const message of this.messages) {
            b.storeUint(message.mode, 8)
            b.storeRef(beginCell().store(storeMessageRelaxed(message.message)).endCell())
        }
        this.messagesCell = b.endCell()
    }

    public addSignature (ownerId: number, secretKey: Buffer) {
        this.signatures.set(ownerId, sign(this.messagesCell.hash(), secretKey))
    }

    public unionSignatures (other: Order) {
        for (const [key, value] of other.signatures) {
            this.signatures.set(key, value)
        }
    }

    public clearSignatures () {
        this.signatures = Dictionary.empty()
    }

    private getQuerryId () {
        const time = BigInt(Math.floor(Date.now() / 1000 + this.queryOffset))
        return time << 32n
    }
}

