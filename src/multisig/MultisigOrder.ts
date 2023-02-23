/* Made by @Gusarich and @Miandic */

import { sign, signVerify } from 'ton-crypto';
import { Cell } from 'ton-core';
import { MultisigWallet } from './MultisigWallet';

export class MultisigOrder {

    public readonly messagesCell: Cell;
    public signatures: {[key: number]: Buffer} = {};

    constructor(messagesCell: Cell) {
        this.messagesCell = messagesCell;
    }

    public addSignature(ownerId: number, signature: Buffer, multisig: MultisigWallet) {
        const signingHash = this.messagesCell.hash();
        if (!signVerify(signingHash, signature, multisig.owners.get(ownerId)!.slice(0, -1))) {   
            throw('invalid signature');
        }
        this.signatures[ownerId] = signature;
    }

    public sign(ownerId: number, secretKey: Buffer) {
        const signingHash = this.messagesCell.hash();
        this.signatures[ownerId] = sign(signingHash, secretKey);
    }

    public unionSignatures(other: MultisigOrder) {
        this.signatures = Object.assign({}, this.signatures, other.signatures);
    }

    public clearSignatures() {
        this.signatures = {};
    }

}
