var BigNumber = global.web3.BigNumber;
var sha3 = global.web3.sha3;
                  
function str(a) {
   a = a.toString(16);
   if (a.startsWith("0x")) a = a.substr(2);
   let x = ("0000000000000000000000000000000000000000000000000000000000000000"+a).substr(-64);
   return x;
}

const zero = str(0);

function str32(a) {
    a = a.toString(16);
    if (a.startsWith("0x")) a = a.substr(2);

    return ("00000000"+a).substr(-8);
}

function sha3_1(a) {
    let aa = str(a);

    return sha3("0x"+aa, {encoding: 'hex'});
}

function sha3_2(a,b) {
    let aa = str(a);
    let bb = str(b);

    return sha3("0x"+aa+bb, {encoding: 'hex'});
}

function sha3_uint32(list) {
    let a = "";
    let b = "";

    for(let i = 0; i<8; i++) {
        a = a + str32(list[i]);
        b = b + str32(list[i+8]);
    }

    return sha3('0x'+a+b, {encoding: 'hex'});
}

function merkle(list) {
    let a = [];
    let leafs = [];

    for(let i = 0; i<list.length; i++) {
        a[i] = { v: sha3_1(list[i]) };
        leafs[i] = a[i];    
    }
    let zero = { v: 0 };

    while (a.length > 1) {
        let b = [];
        for(let i = 0; i<a.length; i+=2) {
            if (i == a.length-1) {
                let l = a[i];
                let r = zero;
                b.push({l, r, v: sha3_2(l.v,r.v)});
                a[i].p = b[b.length-1];
            } else {
                let l = a[i];
                let r = a[i+1];
                b.push({l, r, v: sha3_2(l.v,r.v)});
                a[i].p = a[i+1].p = b[b.length-1];
            }
        }
        a = b; 
    }

    a[0].leafs = leafs;
    a[0].roothash = a[0].v;
    return a[0];
}

function getProof(tree, index) {
    let proof = [];
    let node = tree.leafs[index];

    if (node == undefined) return undefined;

    while (node.roothash == undefined) {
        let p = node.p;
        if (node == p.l ) {
            proof.push({d:'r', v: p.r.v});
        } else {
            proof.push({d:'l', v: p.l.v});
        }
        node = node.p;
    } 
    return proof;
}

function evalProof(proof, value) {
    let hash = sha3_1(value);

    for(let i = 0;i<proof.length;i++) {
        let x = proof[i];
        if (x.d == 'l') {
            hash = sha3_2(x.v, hash);
        } else {
            hash = sha3_2(hash, x.v);
        }
    }

    return hash;
}

module.exports = {
    sha3_2,
    sha3_uint32,
    sha3_1,
    merkle,
    getProof,
    evalProof,
}



