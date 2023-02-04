import Prando from 'prando';
import { Address } from '../index'

export function testAddress(seed: string, workchain: number = 0) {
    const random = new Prando(seed);
    const hash = Buffer.alloc(32);
    for (let i = 0; i < hash.length; i++) {
        hash[i] = random.nextInt(0, 255);
    }
    return new Address(workchain, hash);
}