import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

export function isS3Configured(): boolean {
  const bucketName = (process.env.S3_BUCKET_NAME || '').trim();
  const accessKeyId = (process.env.S3_ACCESS_KEY_ID || '').trim();
  const secretAccessKey = (process.env.S3_SECRET_ACCESS_KEY || '').trim();
  return Boolean(bucketName && accessKeyId && secretAccessKey);
}

export async function uploadToS3(filename: string, buffer: Buffer, contentType: string): Promise<string> {
  const bucketName = (process.env.S3_BUCKET_NAME || '').trim();
  const accessKeyId = (process.env.S3_ACCESS_KEY_ID || '').trim();
  const secretAccessKey = (process.env.S3_SECRET_ACCESS_KEY || '').trim();
  const region = (process.env.S3_REGION || 'us-east-1').trim();
  const endpoint = (process.env.S3_ENDPOINT || '').trim();
  const publicUrlPrefix = (process.env.S3_PUBLIC_URL_PREFIX || '').trim();

  const clientConfig: any = {
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    region,
  };

  if (endpoint) {
    clientConfig.endpoint = endpoint;
    clientConfig.forcePathStyle = true;
  }

  const s3 = new S3Client(clientConfig);

  try {
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: filename,
      Body: buffer,
      ContentType: contentType,
      ACL: 'public-read',
    });
    await s3.send(command);
  } catch (err) {
    // Retry without ACL for S3-compatible providers that disable ACLs by default (e.g. Cloudflare R2)
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: filename,
      Body: buffer,
      ContentType: contentType,
    });
    await s3.send(command);
  }

  // Generate public URL
  if (publicUrlPrefix) {
    const base = publicUrlPrefix.endsWith('/') ? publicUrlPrefix : `${publicUrlPrefix}/`;
    return `${base}${filename}`;
  }

  if (endpoint) {
    const cleanEndpoint = endpoint.replace(/^https?:\/\//, '');
    const protocol = endpoint.startsWith('https') ? 'https' : 'http';
    return `${protocol}://${cleanEndpoint}/${bucketName}/${filename}`;
  }

  return `https://${bucketName}.s3.${region}.amazonaws.com/${filename}`;
}
