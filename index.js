const { Wavelet, Contract, TAG_TRANSFER } = require("./dist/wavelet-gas-estimate.umd.js");
// const { Wavelet, Contract, TAG_TRANSFER } = require('wavelet-client');

const JSBI = require('jsbi');
const BigInt = JSBI.BigInt;
 
const client = new Wavelet("http://localhost:9000");


(async () => {
    console.log(await client.getNodeInfo());
    const wallet = Wavelet.loadWalletFromPrivateKey('87a6813c3b4cf534b6ae82db9b1409fa7dbd5c13dba5858970b56084c4a930eb400056ee68a7cc2695222df05ea76875bc27ec6e61e8e62317c336157019c405');
    const account = await client.getAccount(Buffer.from(wallet.publicKey).toString("hex"));
 
    const contract = new Contract(client, 'ec9f296ff58585082520a88c4ef697a2cb9337214a0406249689603c8724b762');
    await contract.addLife();
    await contract.init();
    

    console.log('contract', contract);

    
    // console.log(contract.test(wallet, 'on_money_received', BigInt(120)));
    console.log(contract.est(wallet, 'on_money_received', BigInt(120)));
    
    
    // const result = await run("transfer_back.wasm", "_contract_on_money_received", 100, 1203);
    // console.log(result);
})();