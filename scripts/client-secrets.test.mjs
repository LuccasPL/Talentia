import test from 'node:test';
import assert from 'node:assert/strict';
import {hasPrivateCredential} from './audit-client-secrets.mjs';
test('scanner allows publishable keys but catches private keys and service role tokens',()=>{
 assert.equal(hasPrivateCredential('sb_publishable_fixture_public'),false);
 for(const prefix of ['sk-ant-','re_','sb_secret_'])assert.equal(hasPrivateCredential(prefix+'x'.repeat(35)),true);
 const jwt=role=>`eyJheader.${Buffer.from(JSON.stringify({role})).toString('base64url')}.signature`;
 assert.equal(hasPrivateCredential(jwt('anon')),false);assert.equal(hasPrivateCredential(jwt('service_role')),true);
 assert.equal(hasPrivateCredential('bundled-custom-secret-value',['custom-secret-value']),true);
});
