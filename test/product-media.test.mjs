import test from 'node:test';
import assert from 'node:assert/strict';
import { fromProduct } from '../src/services/productRecord.js';
import { mediaItems, mediaStyle, safeMediaUrl, primaryImage } from '../src/media/media.js';
test('database product ID wins over a previously stored client ID',()=>{
 const product=fromProduct({id:'database-id',name:'Flower',data:{id:'old-client-id',stock:3,media:[{type:'video',url:'https://example.com/test.mp4'}]}});
 assert.equal(product.id,'database-id');assert.equal(product.legacyId,'old-client-id');assert.equal(product.stock,3);assert.equal(product.media.length,1);
});
test('legacy photos remain visible and media supports multiple videos and images',()=>{
 assert.equal(mediaItems({imageUrl:'https://example.com/old.jpg'})[0].url,'https://example.com/old.jpg');
 const media=[{type:'video',url:'https://example.com/a.mp4'},{type:'image',url:'/api/v1/uploads/businesses/user/abc'},{type:'video',url:'https://example.com/b.webm'}];
 assert.deepEqual(mediaItems({media}).map(({id,...item})=>item),media);assert.equal(primaryImage(media),media[1].url);
 assert.equal(safeMediaUrl('javascript:alert(1)'),false);assert.equal(safeMediaUrl('//example.com/test'),false);assert.equal(safeMediaUrl(media[1].url),true);
});
test('media dimensions support percent, pixels, automatic height and fit',()=>{
 assert.equal(mediaStyle({width:50,unit:'%',height:300,fit:'contain'}).height,'300px');
 assert.equal(mediaStyle({width:50,align:'center',aspectRatio:'16 / 9',focalX:20,mobileWidth:80})['--media-position'],'20% 50%');
 assert.equal(mediaStyle({mobileWidth:80})['--media-mobile-width'],'80%');
 assert.equal(mediaStyle({width:640,unit:'px'}).width,'640px');assert.equal(mediaStyle({width:999,unit:'%'}).width,'100%');
});
