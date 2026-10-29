import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { S3Client, PutObjectCommand, HeadObjectCommand, GetObjectCommand, CopyObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID, createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { DbService } from './database';

const run = promisify(execFile);
export const IMAGE_LIMIT = 20 * 1024 * 1024;
export const VIDEO_LIMIT = 250 * 1024 * 1024;
export const MEDIA_TYPES = ['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm'];
export function validateUpload(type: unknown, size: unknown, checksum: unknown) {
  if (typeof type !== 'string' || !MEDIA_TYPES.includes(type)) throw new BadRequestException('Choose JPEG, PNG, WebP, GIF, MP4 (H.264/AAC), or WebM (VP8/VP9/Opus). Convert MOV/HEVC files to MP4 H.264 first.');
  const limit = type.startsWith('video/') ? VIDEO_LIMIT : IMAGE_LIMIT;
  if (!Number.isSafeInteger(size) || Number(size) < 1 || Number(size) > limit) throw new BadRequestException(`${type.startsWith('video/') ? 'Videos must be 250' : 'Images must be 20'} MB or smaller.`);
  if (typeof checksum !== 'string' || !/^[A-Za-z0-9+/]{43}=$/.test(checksum)) throw new BadRequestException('Missing file integrity checksum. Select the file again.');
  return { contentType: type, size: Number(size), checksum };
}
export function matchesSignature(bytes: Buffer, type: string) {
  if (type === 'image/jpeg') return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (type === 'image/png') return bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if (type === 'image/gif') return ['GIF87a','GIF89a'].includes(bytes.toString('ascii',0,6));
  if (type === 'image/webp') return bytes.toString('ascii',0,4) === 'RIFF' && bytes.toString('ascii',8,12) === 'WEBP';
  if (type === 'video/mp4') return bytes.toString('ascii',4,8) === 'ftyp' && !['qt  ','heic','heix','mif1','avif'].includes(bytes.toString('ascii',8,12));
  return type === 'video/webm' && bytes.subarray(0,4).equals(Buffer.from([26,69,223,163]));
}
export function validateProbe(probe: any, type: string) {
  const streams = Array.isArray(probe?.streams) ? probe.streams : [];
  const videos = streams.filter((s: any) => s.codec_type === 'video');
  if (!videos.length || videos.some((s: any) => !s.width || !s.height || s.width * s.height > 40_000_000)) throw new BadRequestException('The media is damaged or exceeds 40 megapixels. Export a smaller valid file.');
  if (type.startsWith('video/')) {
    const codecs = type === 'video/mp4' ? ['h264'] : ['vp8','vp9'];
    const audio = type === 'video/mp4' ? ['aac','mp3'] : ['opus','vorbis'];
    if (videos.some((s: any) => !codecs.includes(s.codec_name)) || streams.some((s: any) => s.codec_type === 'audio' && !audio.includes(s.codec_name))) throw new BadRequestException('Unsupported video codec. Export MP4 with H.264 video/AAC audio or WebM with VP8/VP9 video/Opus audio.');
  }
  return { width: videos[0].width, height: videos[0].height };
}

@Injectable()
export class MediaStorage {
  constructor(private db: DbService) {}
  private config() {
    const keys = ['S3_BUCKET','S3_REGION','S3_ACCESS_KEY_ID','S3_SECRET_ACCESS_KEY'];
    const missing = keys.filter(key => !process.env[key]?.trim());
    if (missing.length) throw new ServiceUnavailableException('Media storage is not configured on this API. Ask the owner to configure a staging S3 bucket and upload CORS. Your design has not been changed.');
    return { bucket: process.env.S3_BUCKET!, client: new S3Client({ region: process.env.S3_REGION!, endpoint: process.env.S3_ENDPOINT || undefined, forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true', credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID!, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY! } }) };
  }
  status() { try { this.config(); return { configured: true, imageLimit: IMAGE_LIMIT, videoLimit: VIDEO_LIMIT, types: MEDIA_TYPES }; } catch { return { configured: false, imageLimit: IMAGE_LIMIT, videoLimit: VIDEO_LIMIT, types: MEDIA_TYPES }; } }
  async authorize(ownerId: string, input: any) {
    const { contentType, size, checksum } = validateUpload(input?.contentType, input?.size, input?.checksum);
    const { bucket, client } = this.config();
    // Reservations are serialized per account, including concurrent browser tabs.
    const asset = await this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${ownerId}), 872031)`;
      const where = { ownerId, OR: [{ status: 'READY' }, { status: 'PENDING', expiresAt: { gt: new Date() } }] };
      const usage = await tx.mediaAsset.aggregate({ where, _sum: { size: true }, _count: true });
      if ((usage._sum.size || 0) + size > 2 * 1024 * 1024 * 1024 || usage._count >= 1000) throw new BadRequestException('This account has reached its 2 GB or 1,000-file media limit. Contact support for more storage.');
      const id = randomUUID();
      return tx.mediaAsset.create({ data: { id, ownerId, contentType, size, checksum, objectKey: `media/${ownerId}/${id}`, expiresAt: new Date(Date.now() + 15 * 60_000) } });
    });
    try {
      const url = await getSignedUrl(client, new PutObjectCommand({ Bucket: bucket, Key: `incoming/${asset.id}`, ContentType: contentType, ContentLength: size, ChecksumSHA256: checksum }), { expiresIn: 900, unhoistableHeaders: new Set(['x-amz-checksum-sha256']), signableHeaders: new Set(['content-type','content-length']) });
      return { id: asset.id, uploadUrl: url, headers: { 'Content-Type': contentType, 'x-amz-checksum-sha256': checksum }, expiresIn: 900 };
    } catch { await this.db.mediaAsset.update({where:{id:asset.id},data:{status:'FAILED'}}); throw new ServiceUnavailableException('Could not authorize storage. Check bucket credentials and region.'); }
  }
  async uploadSmall(ownerId: string, contentType: string, bytes: Buffer) {
    const ticket = await this.authorize(ownerId, {contentType,size:bytes.length,checksum:createHash('sha256').update(bytes).digest('base64')});
    try {
      const response = await fetch(ticket.uploadUrl, {method:'PUT',headers:ticket.headers,body:new Uint8Array(bytes),signal:AbortSignal.timeout(45000)});
      if (!response.ok) throw new Error('Storage rejected upload');
    } catch { throw new ServiceUnavailableException('Media storage could not accept this upload. Please retry.'); }
    return this.complete(ownerId,ticket.id);
  }
  async complete(ownerId: string, id: string) {
    const asset = await this.db.mediaAsset.findFirst({ where: { id, ownerId } });
    if (!asset) throw new NotFoundException('Upload not found');
    if (asset.status === 'READY') return { id, publicUrl: `/api/v1/uploads/media/${id}` };
    if (asset.status !== 'PENDING' || asset.expiresAt < new Date()) throw new BadRequestException('Upload expired. Select the file again to retry.');
    const { bucket, client } = this.config(), key = `incoming/${id}`;
    try {
      const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key, ChecksumMode: 'ENABLED' }));
      if (head.ContentLength !== asset.size || head.ContentType !== asset.contentType || head.ChecksumSHA256 !== asset.checksum) throw new BadRequestException('File integrity check failed. Select the original file and retry.');
      const prefix = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key, Range: 'bytes=0-63' }));
      if (!prefix.Body || !matchesSignature(Buffer.from(await prefix.Body.transformToByteArray()), asset.contentType)) throw new BadRequestException('The file contents do not match its type. Export a valid image or video.');
      const readUrl = await getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 120 });
      let probe;
      try { const { stdout } = await run('ffprobe', ['-v','error','-protocol_whitelist','https,tls,tcp,http,crypto','-show_streams','-of','json',readUrl], { timeout: 45_000, maxBuffer: 1024 * 1024 }); probe = JSON.parse(stdout); }
      catch { throw new BadRequestException('The media cannot be decoded. Export JPEG/PNG/WebP, MP4 H.264/AAC, or WebM VP8/VP9 and retry.'); }
      const dimensions = validateProbe(probe, asset.contentType);
      // A separate immutable key prevents replaying the signed PUT to alter a validated file.
      await client.send(new CopyObjectCommand({ Bucket: bucket, Key: asset.objectKey, CopySource: `${bucket}/${key}`, CopySourceIfMatch: head.ETag, MetadataDirective: 'REPLACE', ContentType: asset.contentType, CacheControl: 'public,max-age=31536000,immutable' }));
      await this.db.mediaAsset.update({ where: { id }, data: { status: 'READY', ...dimensions } });
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })).catch(() => undefined);
      return { id, publicUrl: `/api/v1/uploads/media/${id}`, ...dimensions };
    } catch (error) {
      // Never include SDK errors or ffprobe stderr: they can contain signed credentials.
      if (error instanceof BadRequestException) { await this.db.mediaAsset.updateMany({where:{id,status:'PENDING'},data:{status:'FAILED'}}); throw error; }
      throw new ServiceUnavailableException('Storage could not verify this upload. Check bucket access and retry verification.');
    }
  }
  async publicUrl(id: string) {
    const asset = await this.db.mediaAsset.findFirst({ where: { id, status: 'READY' } });
    if (!asset) throw new NotFoundException('Media not found');
    const { bucket, client } = this.config();
    try { return await getSignedUrl(client, new GetObjectCommand({Bucket:bucket,Key:asset.objectKey,ResponseContentType:asset.contentType,ResponseContentDisposition:'inline'}), {expiresIn:3600}); }
    catch { throw new ServiceUnavailableException('Media storage is temporarily unavailable.'); }
  }
}

// Legacy URLs stay readable. New managed uploads may only be attached by their owner.
export async function assertOwnedMedia(db: DbService, ownerId: string, value: unknown) {
  const ids = [...new Set([...JSON.stringify(value).matchAll(/\/api\/v1\/uploads\/media\/([a-f0-9-]{36})/g)].map(match => match[1]))];
  if (!ids.length) return;
  const count = await db.mediaAsset.count({ where: { id: { in: ids }, ownerId, status: 'READY' } });
  if (count !== ids.length) throw new BadRequestException('Some media belongs to another account or has not finished uploading.');
}
