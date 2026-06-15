'use strict';

/**
 * SCN-051 — AWS SDK configuration
 * اعتبارنامه‌ها از env.config خوانده می‌شوند — هرگز hardcode نمی‌شوند
 */

const { S3Client } = require('@aws-sdk/client-s3');
const { getConfig } = require('./env.config');

let _s3Client = null;

function getS3Client() {
  if (_s3Client) return _s3Client;

  const { aws } = getConfig();

  _s3Client = new S3Client({
    region: aws.region,
    credentials: {
      accessKeyId:     aws.accessKeyId,
      secretAccessKey: aws.secretAccessKey,
    },
    // جلوگیری از لیک اطلاعات در error ها
    logger: {
      debug: () => {},
      info:  () => {},
      warn:  (msg) => console.warn('[AWS]', msg.replace(/AKIA\w+/g, '[REDACTED]')),
      error: (msg) => console.error('[AWS]', typeof msg === 'string'
        ? msg.replace(/AKIA\w+/g, '[REDACTED]')
        : '[Error redacted]'),
    },
  });

  return _s3Client;
}

module.exports = { getS3Client };