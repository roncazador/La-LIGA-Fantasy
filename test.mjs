import assert from 'node:assert/strict';
const allowed=new Set(['profile','leagues','league','squad','budget','market','fixtures','players','stats','rivals','standings','week']);
for(const x of ['buy','sell','bid','clause','blind','lineup-write'])assert.equal(allowed.has(x),false);
console.log('READ-ONLY policy OK');
