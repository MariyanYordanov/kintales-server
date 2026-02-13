import * as Minio from 'minio';

const accessKey = process.env.MINIO_ACCESS_KEY;
const secretKey = process.env.MINIO_SECRET_KEY;

if (!accessKey || !secretKey) {
  throw new Error('MINIO_ACCESS_KEY and MINIO_SECRET_KEY environment variables are required');
}

export const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: parseInt(process.env.MINIO_PORT || '9000', 10),
  useSSL: process.env.NODE_ENV === 'production',
  accessKey,
  secretKey,
});

export const BUCKETS = {
  AVATARS: 'avatars',
  PHOTOS: 'photos',
  AUDIO: 'audio',
};
