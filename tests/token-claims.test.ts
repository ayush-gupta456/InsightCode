import test from 'node:test';
import assert from 'node:assert/strict';
import {SignJWT} from 'jose';
import {authTokens} from '../server/security.js';
test('signed access tokens without mandatory lifetime or identity claims are rejected',async()=>{
 const secret='secure-test-key-'.repeat(4);const tokens=authTokens(secret);
 const incomplete=await new SignJWT({}).setProtectedHeader({alg:'HS256'}).setIssuer('insightcode').setAudience('insightcode-app').setSubject('user').sign(new TextEncoder().encode(secret));
 await assert.rejects(tokens.claims(incomplete));await assert.rejects(tokens.verify(incomplete));
 assert.equal((await tokens.claims(await tokens.sign('user'))).sub,'user');
});
